import SwiftUI

// State machine: collapsed | expanded (view), pending | running | succeeded | failed (exec)
enum ToolInvocationWatchViewState {
    case collapsed
    case expanded
}

enum ToolInvocationWatchExecState {
    case pending
    case running
    case succeeded
    case failed
}

enum ToolInvocationWatchEvent {
    case toggle
    case start
    case succeed
    case fail
}

func toolInvocationWatchViewReduce(_ state: ToolInvocationWatchViewState, _ event: ToolInvocationWatchEvent) -> ToolInvocationWatchViewState {
    switch state {
    case .collapsed:
        if case .toggle = event { return .expanded }
        return state
    case .expanded:
        if case .toggle = event { return .collapsed }
        return state
    }
}

struct ToolInvocationWatchView: View {
    let toolName: String
    let input: String
    var output: String? = nil
    var execStatus: String = "pending" // "pending", "running", "succeeded", "failed"
    var durationMs: Int? = nil
    var errorMessage: String? = nil

    @State private var viewState: ToolInvocationWatchViewState = .collapsed

    private var execColor: Color {
        switch execStatus {
        case "succeeded": return .green
        case "failed": return .red
        case "running": return .blue
        default: return .secondary
        }
    }

    private var execIcon: String {
        switch execStatus {
        case "succeeded": return "checkmark.circle.fill"
        case "failed": return "xmark.circle.fill"
        case "running": return "arrow.triangle.2.circlepath"
        default: return "clock"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            // Header
            Button {
                viewState = toolInvocationWatchViewReduce(viewState, .toggle)
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: viewState == .collapsed ? "chevron.right" : "chevron.down")
                        .font(.system(size: 7)).foregroundColor(.secondary)
                    Image(systemName: "wrench").font(.system(size: 9)).foregroundColor(.blue)
                    Text(toolName).font(.caption2).fontWeight(.semibold).lineLimit(1)
                    Spacer()
                    Image(systemName: execIcon)
                        .font(.system(size: 9))
                        .foregroundColor(execColor)
                    if execStatus == "running" {
                        ProgressView().scaleEffect(0.4)
                    }
                }
            }
            .buttonStyle(.plain)

            if let dur = durationMs {
                Text("\(dur)ms").font(.system(size: 7)).foregroundColor(.secondary)
            }

            if viewState == .expanded {
                // Input
                VStack(alignment: .leading, spacing: 1) {
                    Text("Input").font(.system(size: 7)).fontWeight(.semibold).foregroundColor(.secondary)
                    Text(input)
                        .font(.system(size: 8, design: .monospaced))
                        .lineLimit(6)
                        .padding(3)
                        .background(Color.secondary.opacity(0.08))
                        .cornerRadius(3)
                }

                // Output
                if let output = output {
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Output").font(.system(size: 7)).fontWeight(.semibold).foregroundColor(.secondary)
                        Text(output)
                            .font(.system(size: 8, design: .monospaced))
                            .lineLimit(6)
                            .padding(3)
                            .background(Color.secondary.opacity(0.08))
                            .cornerRadius(3)
                    }
                }

                // Error
                if let error = errorMessage {
                    Text(error)
                        .font(.system(size: 8))
                        .foregroundColor(.red)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Tool invocation: \(toolName), \(execStatus)")
    }
}
