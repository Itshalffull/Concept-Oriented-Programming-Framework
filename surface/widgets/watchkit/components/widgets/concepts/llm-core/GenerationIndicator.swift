import SwiftUI

// State machine: idle | generating | complete | error
enum GenerationIndicatorWatchState {
    case idle
    case generating
    case complete
    case error
}

enum GenerationIndicatorWatchEvent {
    case start
    case token
    case complete
    case error
    case reset
    case retry
}

func generationIndicatorWatchReduce(_ state: GenerationIndicatorWatchState, _ event: GenerationIndicatorWatchEvent) -> GenerationIndicatorWatchState {
    switch state {
    case .idle:
        if case .start = event { return .generating }
        return state
    case .generating:
        switch event {
        case .token: return .generating
        case .complete: return .complete
        case .error: return .error
        default: return state
        }
    case .complete:
        switch event {
        case .reset: return .idle
        case .start: return .generating
        default: return state
        }
    case .error:
        switch event {
        case .reset: return .idle
        case .retry: return .generating
        default: return state
        }
    }
}

struct GenerationIndicatorWatchView: View {
    let status: GenerationIndicatorWatchState
    var model: String? = nil
    var tokenCount: Int? = nil
    var showTokens: Bool = true
    var showModel: Bool = true
    var onCancel: (() -> Void)? = nil
    var onRetry: (() -> Void)? = nil

    @State private var state: GenerationIndicatorWatchState = .idle

    private var statusIcon: String {
        switch state {
        case .idle: return ""
        case .generating: return ""
        case .complete: return "checkmark.circle.fill"
        case .error: return "exclamationmark.triangle.fill"
        }
    }

    private var statusColor: Color {
        switch state {
        case .idle: return .secondary
        case .generating: return .blue
        case .complete: return .green
        case .error: return .red
        }
    }

    private var statusText: String {
        switch state {
        case .idle: return "Idle"
        case .generating: return "Generating..."
        case .complete: return "Complete"
        case .error: return "Error"
        }
    }

    var body: some View {
        VStack(spacing: 4) {
            // Status indicator
            HStack(spacing: 4) {
                if state == .generating {
                    ProgressView()
                        .scaleEffect(0.5)
                } else if !statusIcon.isEmpty {
                    Image(systemName: statusIcon)
                        .font(.system(size: 12))
                        .foregroundColor(statusColor)
                }

                Text(statusText)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(statusColor)
            }

            // Model badge
            if showModel, let model = model {
                Text(model)
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(3)
            }

            // Token count
            if showTokens, let tokens = tokenCount {
                Text("\(tokens) tokens")
                    .font(.system(size: 8))
                    .foregroundColor(.secondary)
            }

            // Error retry button
            if state == .error, let onRetry = onRetry {
                Button("Retry") {
                    onRetry()
                }
                .font(.caption2)
                .buttonStyle(.bordered)
            }

            // Cancel button during generation
            if state == .generating, let onCancel = onCancel {
                Button("Cancel") {
                    onCancel()
                }
                .font(.caption2)
                .foregroundColor(.red)
                .buttonStyle(.plain)
            }
        }
        .onAppear {
            state = status
        }
        .onChange(of: status) { _, newValue in
            state = newValue
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Generation \(statusText)")
        .accessibilityValue(tokenCount != nil ? "\(tokenCount!) tokens" : "")
    }
}
