import SwiftUI

// State machine: idle | live | suspended | completed | failed | cancelled
enum ExecutionOverlayWatchState {
    case idle
    case live
    case suspended
    case completed
    case failed
    case cancelled
}

enum ExecutionOverlayWatchEvent {
    case start
    case stepAdvance
    case complete
    case fail
    case suspend
    case cancel
    case resume
    case reset
    case retry
}

func executionOverlayWatchReduce(_ state: ExecutionOverlayWatchState, _ event: ExecutionOverlayWatchEvent) -> ExecutionOverlayWatchState {
    switch state {
    case .idle:
        if case .start = event { return .live }
        return state
    case .live:
        switch event {
        case .stepAdvance: return .live
        case .complete: return .completed
        case .fail: return .failed
        case .suspend: return .suspended
        case .cancel: return .cancelled
        default: return state
        }
    case .suspended:
        switch event {
        case .resume: return .live
        case .cancel: return .cancelled
        default: return state
        }
    case .completed:
        if case .reset = event { return .idle }
        return state
    case .failed:
        switch event {
        case .reset: return .idle
        case .retry: return .live
        default: return state
        }
    case .cancelled:
        if case .reset = event { return .idle }
        return state
    }
}

struct ExecutionStepData: Identifiable {
    let id: String
    let label: String
    let status: String // "active", "complete", "pending", "failed", "skipped"
}

struct ExecutionOverlayWatchView: View {
    let status: String
    var activeStep: String? = nil
    var steps: [ExecutionStepData] = []
    var errorMessage: String? = nil
    var showControls: Bool = true
    var onSuspend: (() -> Void)? = nil
    var onResume: (() -> Void)? = nil
    var onCancel: (() -> Void)? = nil
    var onRetry: (() -> Void)? = nil

    @State private var state: ExecutionOverlayWatchState = .idle

    private func stepIcon(_ status: String) -> String {
        switch status {
        case "complete": return "checkmark.circle.fill"
        case "active": return "play.circle.fill"
        case "failed": return "xmark.circle.fill"
        case "skipped": return "forward.fill"
        default: return "circle"
        }
    }

    private func stepColor(_ status: String) -> Color {
        switch status {
        case "complete": return .green
        case "active": return .blue
        case "failed": return .red
        case "skipped": return .secondary
        default: return .secondary
        }
    }

    private var statusColor: Color {
        switch state {
        case .idle: return .secondary
        case .live: return .blue
        case .suspended: return .orange
        case .completed: return .green
        case .failed: return .red
        case .cancelled: return .secondary
        }
    }

    private var statusText: String {
        switch state {
        case .idle: return "Idle"
        case .live: return "Running"
        case .suspended: return "Suspended"
        case .completed: return "Completed"
        case .failed: return "Failed"
        case .cancelled: return "Cancelled"
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Status header
                HStack(spacing: 4) {
                    if state == .live {
                        ProgressView()
                            .scaleEffect(0.4)
                    } else {
                        Circle()
                            .fill(statusColor)
                            .frame(width: 6, height: 6)
                    }
                    Text(statusText)
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(statusColor)
                }

                // Error banner
                if state == .failed, let error = errorMessage {
                    HStack(spacing: 3) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.system(size: 8))
                            .foregroundColor(.red)
                        Text(error)
                            .font(.system(size: 8))
                            .foregroundColor(.red)
                            .lineLimit(2)
                    }
                    .padding(4)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(3)
                }

                // Steps list
                if !steps.isEmpty {
                    ForEach(steps) { step in
                        HStack(spacing: 4) {
                            if step.status == "active" {
                                ProgressView()
                                    .scaleEffect(0.3)
                                    .frame(width: 10, height: 10)
                            } else {
                                Image(systemName: stepIcon(step.status))
                                    .font(.system(size: 8))
                                    .foregroundColor(stepColor(step.status))
                            }
                            Text(step.label)
                                .font(.system(size: 9))
                                .foregroundColor(step.status == "pending" ? .secondary : .primary)
                                .lineLimit(1)
                            Spacer()
                        }
                    }
                }

                // Controls
                if showControls {
                    HStack(spacing: 8) {
                        if state == .live, let onSuspend = onSuspend {
                            Button {
                                onSuspend()
                                state = executionOverlayWatchReduce(state, .suspend)
                            } label: {
                                Image(systemName: "pause.circle")
                                    .font(.system(size: 14))
                            }
                            .buttonStyle(.plain)
                        }

                        if state == .suspended, let onResume = onResume {
                            Button {
                                onResume()
                                state = executionOverlayWatchReduce(state, .resume)
                            } label: {
                                Image(systemName: "play.circle")
                                    .font(.system(size: 14))
                            }
                            .buttonStyle(.plain)
                        }

                        if (state == .live || state == .suspended), let onCancel = onCancel {
                            Button {
                                onCancel()
                                state = executionOverlayWatchReduce(state, .cancel)
                            } label: {
                                Image(systemName: "stop.circle")
                                    .font(.system(size: 14))
                                    .foregroundColor(.red)
                            }
                            .buttonStyle(.plain)
                        }

                        if state == .failed, let onRetry = onRetry {
                            Button("Retry") {
                                onRetry()
                                state = executionOverlayWatchReduce(state, .retry)
                            }
                            .font(.caption2)
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution overlay, \(statusText)")
    }
}
