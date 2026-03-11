import SwiftUI

enum ToolCallDetailWidgetState {
    case idle, retrying
}

enum ToolCallDetailEvent {
    case expandArgs, expandResult, retry, retryComplete, retryError
}

func toolCallDetailReduce(state: ToolCallDetailWidgetState, event: ToolCallDetailEvent) -> ToolCallDetailWidgetState {
    switch state {
    case .idle:
        if event == .retry { return .retrying }
        return state
    case .retrying:
        if event == .retryComplete { return .idle }
        if event == .retryError { return .idle }
        return state
    }
}

struct ToolCallDetailView: View {
    var toolName: String
    var input: String
    var output: String? = nil
    var status: String = "pending"
    var duration: Int? = nil
    var timestamp: String? = nil
    var arguments: String = ""
    var result: String? = nil
    var timing: Int? = nil
    var tokenUsage: Int? = nil
    var error: String? = nil
    var showTiming: Bool = true
    var showTokens: Bool = true
    var onRetry: (() -> Void)? = nil

    @State private var widgetState: ToolCallDetailWidgetState = .idle
    @State private var argsExpanded: Bool = true
    @State private var resultExpanded: Bool = true

    private var resolvedInput: String { input.isEmpty ? arguments : input }
    private var resolvedOutput: String? { output ?? result }
    private var resolvedDuration: Int? { duration ?? timing }
    private var resolvedStatus: String { error != nil ? "error" : status }
    private var errorMessage: String? { error ?? (resolvedStatus == "error" && resolvedOutput != nil ? resolvedOutput : nil) }

    private func formatJson(_ value: String) -> String {
        guard let data = value.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data),
              let pretty = try? JSONSerialization.data(withJSONObject: obj, options: .prettyPrinted),
              let str = String(data: pretty, encoding: .utf8)
        else { return value }
        return str
    }

    private var statusColor: Color {
        switch resolvedStatus {
        case "success": return .green
        case "error": return .red
        case "pending": return .orange
        default: return .secondary
        }
    }

    private var statusLabel: String {
        switch resolvedStatus {
        case "success": return "Success"
        case "error": return "Error"
        case "pending": return "Pending"
        default: return resolvedStatus.capitalized
        }
    }

    private var statusBgColor: Color {
        switch resolvedStatus {
        case "success": return Color.green.opacity(0.15)
        case "error": return Color.red.opacity(0.15)
        case "pending": return Color.orange.opacity(0.15)
        default: return Color.secondary.opacity(0.1)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 8) {
                Text(toolName)
                    .font(.system(.body, design: .monospaced))
                    .fontWeight(.semibold)

                Text(statusLabel)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(statusBgColor)
                    .foregroundColor(statusColor)
                    .cornerRadius(12)
                    .accessibilityLabel("Status: \(statusLabel)")

                Spacer()

                if let dur = resolvedDuration, showTiming {
                    Text("\(dur)ms")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)

            Divider()

            // Input section (collapsible)
            VStack(alignment: .leading, spacing: 0) {
                Button {
                    withAnimation { argsExpanded.toggle() }
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: argsExpanded ? "chevron.down" : "chevron.right")
                            .font(.caption)
                        Text("Input")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .accessibilityLabel(argsExpanded ? "Collapse input" : "Expand input")

                if argsExpanded {
                    Text(formatJson(resolvedInput))
                        .font(.system(.caption, design: .monospaced))
                        .padding(.horizontal, 12)
                        .padding(.bottom, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.gray.opacity(0.05))
                        .accessibilityLabel("Arguments")
                }
            }

            Divider()

            // Output section (collapsible)
            if resolvedOutput != nil || errorMessage != nil {
                VStack(alignment: .leading, spacing: 0) {
                    Button {
                        withAnimation { resultExpanded.toggle() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: resultExpanded ? "chevron.down" : "chevron.right")
                                .font(.caption)
                            Text("Output")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .accessibilityLabel(resultExpanded ? "Collapse output" : "Expand output")

                    if resultExpanded {
                        if resolvedStatus == "error", let errMsg = errorMessage {
                            Text(errMsg)
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.red)
                                .padding(.horizontal, 12)
                                .padding(.bottom, 8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.05))
                                .overlay(
                                    Rectangle().fill(Color.red).frame(width: 3),
                                    alignment: .leading
                                )
                                .accessibilityRole(.alert)
                                .accessibilityLabel("Error details")
                        } else if let out = resolvedOutput {
                            Text(formatJson(out))
                                .font(.system(.caption, design: .monospaced))
                                .padding(.horizontal, 12)
                                .padding(.bottom, 8)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.gray.opacity(0.05))
                                .accessibilityLabel("Result")
                        }
                    }
                }

                Divider()
            }

            // Token usage badge
            if showTokens, let usage = tokenUsage {
                Text("\(usage) tokens")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .overlay(
                        Capsule().stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                    .padding(.horizontal, 12)
                    .padding(.top, 8)
            }

            // Timestamp
            if let ts = timestamp {
                Text(ts)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.top, 4)
                    .padding(.bottom, 8)
            }

            // Retry button
            if errorMessage != nil {
                Button(widgetState == .retrying ? "Retrying..." : "Retry") {
                    guard widgetState != .retrying else { return }
                    widgetState = toolCallDetailReduce(state: widgetState, event: .retry)
                    onRetry?()
                }
                .disabled(widgetState == .retrying)
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .accessibilityLabel("Retry tool call")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tool call: \(toolName)")
    }
}
