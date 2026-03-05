import SwiftUI

// MARK: - State Machine

enum ToolInvocationViewState { case collapsed, hoveredCollapsed, expanded }
enum ToolInvocationExecState: String { case pending, running, succeeded, failed }

enum ToolInvocationViewEvent { case expand, collapse, hover, leave }
enum ToolInvocationExecEvent { case invoke, success, failure, retry, reset }

func toolViewReduce(state: ToolInvocationViewState, event: ToolInvocationViewEvent) -> ToolInvocationViewState {
    switch state {
    case .collapsed:
        switch event { case .expand: return .expanded; case .hover: return .hoveredCollapsed; default: return state }
    case .hoveredCollapsed:
        switch event { case .leave: return .collapsed; case .expand: return .expanded; default: return state }
    case .expanded:
        if case .collapse = event { return .collapsed }
        return state
    }
}

func toolExecReduce(state: ToolInvocationExecState, event: ToolInvocationExecEvent) -> ToolInvocationExecState {
    switch state {
    case .pending:
        if case .invoke = event { return .running }
        return state
    case .running:
        switch event { case .success: return .succeeded; case .failure: return .failed; default: return state }
    case .succeeded:
        if case .reset = event { return .pending }
        return state
    case .failed:
        switch event { case .retry: return .running; case .reset: return .pending; default: return state }
    }
}

private func statusToExec(_ s: String) -> ToolInvocationExecState {
    switch s { case "running": return .running; case "succeeded": return .succeeded; case "failed": return .failed; default: return .pending }
}

private let execIcons: [ToolInvocationExecState: String] = [
    .pending: "\u{2022}", .running: "\u{25CB}", .succeeded: "\u{2713}", .failed: "\u{2717}"
]

private let execLabels: [ToolInvocationExecState: String] = [
    .pending: "Pending", .running: "Running", .succeeded: "Succeeded", .failed: "Failed"
]

// MARK: - View

struct ToolInvocationView: View {
    let toolName: String
    let arguments: String
    var result: String?
    var status: String = "pending"
    var duration: Int?
    var onRetry: (() -> Void)?
    var defaultExpanded: Bool = false
    var showArguments: Bool = true
    var showResult: Bool = true
    var isDestructive: Bool = false

    @State private var viewState: ToolInvocationViewState = .collapsed
    @State private var execState: ToolInvocationExecState = .pending

    private var isExpanded: Bool { viewState == .expanded }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            Button(action: toggleExpand) {
                HStack(spacing: 8) {
                    Text("\u{2699}").font(.system(size: 16))
                    Text(toolName).fontWeight(.medium)
                    if isDestructive {
                        Text("\u{26A0}").foregroundColor(.orange).accessibilityLabel("Destructive tool")
                    }
                    Spacer()
                    Text(execIcons[execState] ?? "").foregroundColor(execState == .failed ? .red : .primary)
                    if let d = duration { Text("\(d)ms").font(.caption).foregroundColor(.secondary) }
                }
                .padding(.horizontal, 12).padding(.vertical, 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(toolName) \u{2014} \(execLabels[execState] ?? "")")

            if isExpanded {
                VStack(alignment: .leading, spacing: 8) {
                    if showArguments {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Arguments").font(.caption).foregroundColor(.secondary)
                            Text(formatJson(arguments)).font(.system(size: 12, design: .monospaced))
                                .padding(8).background(Color.gray.opacity(0.08)).cornerRadius(4)
                        }
                    }

                    if showResult, let r = result {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Result").font(.caption).foregroundColor(.secondary)
                            Text(formatJson(r)).font(.system(size: 12, design: .monospaced))
                                .padding(8).background(Color.gray.opacity(0.08)).cornerRadius(4)
                        }
                    }

                    if execState == .failed {
                        Button("Retry") {
                            execState = toolExecReduce(state: execState, event: .retry)
                            onRetry?()
                        }.font(.caption).accessibilityLabel("Retry tool call")
                    }
                }
                .padding(.horizontal, 12).padding(.bottom, 12)
            }
        }
        .onAppear {
            viewState = defaultExpanded ? .expanded : .collapsed
            execState = statusToExec(status)
        }
        .onChange(of: status) { s in execState = statusToExec(s) }
        .onHover { h in
            if h { viewState = toolViewReduce(state: viewState, event: .hover) }
            else { viewState = toolViewReduce(state: viewState, event: .leave) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tool call: \(toolName)")
    }

    private func toggleExpand() {
        viewState = isExpanded
            ? toolViewReduce(state: viewState, event: .collapse)
            : toolViewReduce(state: viewState, event: .expand)
    }

    private func formatJson(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
              let str = String(data: pretty, encoding: .utf8) else { return raw }
        return str
    }
}
