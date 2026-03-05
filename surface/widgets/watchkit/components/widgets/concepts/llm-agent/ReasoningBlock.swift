import SwiftUI

// State machine: collapsed | expanded | streaming
enum ReasoningBlockWatchState {
    case collapsed
    case expanded
    case streaming
}

enum ReasoningBlockWatchEvent {
    case toggle
    case streamStart
    case streamEnd
}

func reasoningBlockWatchReduce(_ state: ReasoningBlockWatchState, _ event: ReasoningBlockWatchEvent) -> ReasoningBlockWatchState {
    switch state {
    case .collapsed:
        switch event {
        case .toggle: return .expanded
        case .streamStart: return .streaming
        default: return state
        }
    case .expanded:
        if case .toggle = event { return .collapsed }
        return state
    case .streaming:
        if case .streamEnd = event { return .expanded }
        return state
    }
}

struct ReasoningBlockWatchView: View {
    let content: String
    var label: String = "Reasoning"
    var isStreaming: Bool = false
    var tokenCount: Int? = nil
    var durationMs: Int? = nil

    @State private var state: ReasoningBlockWatchState = .collapsed

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header - tap to expand/collapse
            Button {
                state = reasoningBlockWatchReduce(state, .toggle)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: state == .collapsed ? "chevron.right" : "chevron.down")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                    Image(systemName: "brain")
                        .font(.system(size: 9))
                        .foregroundColor(.purple)
                    Text(label)
                        .font(.caption2)
                        .fontWeight(.semibold)
                    Spacer()
                    if isStreaming || state == .streaming {
                        ProgressView().scaleEffect(0.4)
                    }
                }
            }
            .buttonStyle(.plain)

            // Metadata
            HStack(spacing: 6) {
                if let tokens = tokenCount {
                    Text("\(tokens) tokens")
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                }
                if let dur = durationMs {
                    Text("\(dur)ms")
                        .font(.system(size: 7))
                        .foregroundColor(.secondary)
                }
            }

            // Content (shown when expanded or streaming)
            if state != .collapsed {
                Text(content)
                    .font(.system(size: 9))
                    .foregroundColor(.primary.opacity(0.8))
                    .padding(4)
                    .background(Color.purple.opacity(0.05))
                    .cornerRadius(4)
            }
        }
        .onAppear {
            if isStreaming {
                state = reasoningBlockWatchReduce(state, .streamStart)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(state == .collapsed ? "collapsed" : "expanded")")
    }
}
