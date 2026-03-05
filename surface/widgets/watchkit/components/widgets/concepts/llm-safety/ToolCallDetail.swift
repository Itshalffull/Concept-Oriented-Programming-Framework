import SwiftUI

// State machine: collapsed | expanded
enum ToolCallDetailWatchState {
    case collapsed
    case expanded
}

// Execution status: pending | running | succeeded | failed
enum ToolCallExecWatchStatus {
    case pending
    case running
    case succeeded
    case failed
}

enum ToolCallDetailWatchEvent {
    case toggle
    case collapse
    case expand
}

func toolCallDetailWatchReduce(_ state: ToolCallDetailWatchState, _ event: ToolCallDetailWatchEvent) -> ToolCallDetailWatchState {
    switch state {
    case .collapsed:
        switch event {
        case .toggle, .expand: return .expanded
        default: return state
        }
    case .expanded:
        switch event {
        case .toggle, .collapse: return .collapsed
        default: return state
        }
    }
}

struct ToolCallDetailWatchView: View {
    let toolName: String
    var executionStatus: ToolCallExecWatchStatus = .pending
    var input: String? = nil
    var output: String? = nil
    var errorMessage: String? = nil
    var duration: String? = nil
    var startedExpanded: Bool = false

    @State private var state: ToolCallDetailWatchState = .collapsed

    private var statusIcon: String {
        switch executionStatus {
        case .pending: return "clock"
        case .running: return "arrow.triangle.2.circlepath"
        case .succeeded: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    private var statusColor: Color {
        switch executionStatus {
        case .pending: return .secondary
        case .running: return .blue
        case .succeeded: return .green
        case .failed: return .red
        }
    }

    private var statusText: String {
        switch executionStatus {
        case .pending: return "Pending"
        case .running: return "Running"
        case .succeeded: return "Succeeded"
        case .failed: return "Failed"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Header - tappable to expand/collapse
            Button {
                state = toolCallDetailWatchReduce(state, .toggle)
            } label: {
                HStack(spacing: 4) {
                    // Status icon
                    if executionStatus == .running {
                        ProgressView()
                            .scaleEffect(0.4)
                    } else {
                        Image(systemName: statusIcon)
                            .font(.system(size: 9))
                            .foregroundColor(statusColor)
                    }

                    // Tool name
                    Text(toolName)
                        .font(.system(size: 9, weight: .semibold, design: .monospaced))
                        .lineLimit(1)

                    Spacer()

                    // Duration
                    if let duration = duration {
                        Text(duration)
                            .font(.system(size: 7))
                            .foregroundColor(.secondary)
                    }

                    // Expand chevron
                    Image(systemName: state == .expanded ? "chevron.down" : "chevron.right")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }
            }
            .buttonStyle(.plain)

            // Expanded content
            if state == .expanded {
                VStack(alignment: .leading, spacing: 4) {
                    // Status line
                    HStack(spacing: 3) {
                        Text("Status:")
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                        Text(statusText)
                            .font(.system(size: 8, weight: .semibold))
                            .foregroundColor(statusColor)
                    }

                    // Input
                    if let input = input {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Input")
                                .font(.system(size: 7, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(input)
                                .font(.system(size: 8, design: .monospaced))
                                .lineLimit(6)
                                .padding(3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.secondary.opacity(0.05))
                                .cornerRadius(3)
                        }
                    }

                    // Output
                    if let output = output {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Output")
                                .font(.system(size: 7, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(output)
                                .font(.system(size: 8, design: .monospaced))
                                .lineLimit(6)
                                .padding(3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.green.opacity(0.05))
                                .cornerRadius(3)
                        }
                    }

                    // Error
                    if let errorMessage = errorMessage {
                        VStack(alignment: .leading, spacing: 1) {
                            Text("Error")
                                .font(.system(size: 7, weight: .bold))
                                .foregroundColor(.red)
                            Text(errorMessage)
                                .font(.system(size: 8))
                                .foregroundColor(.red)
                                .lineLimit(4)
                                .padding(3)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.05))
                                .cornerRadius(3)
                        }
                    }
                }
                .padding(.leading, 12)
            }
        }
        .onAppear {
            if startedExpanded {
                state = .expanded
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tool call \(toolName), \(statusText)")
    }
}
