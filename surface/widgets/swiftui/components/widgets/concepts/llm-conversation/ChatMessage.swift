import SwiftUI

// MARK: - State Machine

enum ChatMessageState { case idle, hovered, streaming, copied }
enum ChatMessageEvent { case hover, leave, streamStart, streamEnd, copy, copyTimeout }

func chatMessageReduce(state: ChatMessageState, event: ChatMessageEvent) -> ChatMessageState {
    switch state {
    case .idle:
        switch event {
        case .hover: return .hovered
        case .streamStart: return .streaming
        case .copy: return .copied
        default: return state
        }
    case .hovered:
        switch event {
        case .leave: return .idle
        case .copy: return .copied
        case .streamStart: return .streaming
        default: return state
        }
    case .streaming:
        if case .streamEnd = event { return .idle }
        return state
    case .copied:
        if case .copyTimeout = event { return .idle }
        return state
    }
}

enum MessageRole: String { case user, assistant, system, tool }

private let roleAvatars: [MessageRole: String] = [.user: "\u{1F464}", .assistant: "\u{1F916}", .system: "\u{2699}", .tool: "\u{1F527}"]
private let roleLabels: [MessageRole: String] = [.user: "User", .assistant: "Assistant", .system: "System", .tool: "Tool"]

// MARK: - View

struct ChatMessageView: View {
    let role: MessageRole
    let content: String
    let timestamp: String
    var variant: String = "default"
    var showAvatar: Bool = true
    var showTimestamp: Bool = true
    var isStreaming: Bool = false
    var onCopy: (() -> Void)?
    var onRegenerate: (() -> Void)?
    var onEdit: (() -> Void)?

    @State private var widgetState: ChatMessageState = .idle
    @State private var copyTimer: Timer?

    private var actionsVisible: Bool { widgetState == .hovered && !isStreaming }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .top, spacing: 8) {
                if showAvatar {
                    Text(roleAvatars[role] ?? String(role.rawValue.prefix(1)).uppercased())
                        .font(.system(size: 18))
                        .frame(width: 32, height: 32)
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(roleLabels[role] ?? role.rawValue.capitalized).font(.caption).foregroundColor(.secondary)

                    HStack(alignment: .bottom) {
                        Text(content).font(.system(size: 14))
                        if isStreaming {
                            Rectangle().fill(Color.primary).frame(width: 2, height: 14)
                                .opacity(0.7)
                        }
                    }
                }

                Spacer()
            }

            HStack {
                if showTimestamp {
                    Text(timestamp).font(.caption2).foregroundColor(.secondary)
                }
                Spacer()

                if actionsVisible {
                    HStack(spacing: 8) {
                        Button(widgetState == .copied ? "Copied!" : "Copy") { handleCopy() }.font(.caption)
                        if role == .assistant, let regen = onRegenerate {
                            Button("Regenerate") { regen() }.font(.caption)
                        }
                        if role == .user, let edit = onEdit {
                            Button("Edit") { edit() }.font(.caption)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .onHover { h in
            if h { widgetState = chatMessageReduce(state: widgetState, event: .hover) }
            else { widgetState = chatMessageReduce(state: widgetState, event: .leave) }
        }
        .onChange(of: isStreaming) { s in
            if s { widgetState = chatMessageReduce(state: widgetState, event: .streamStart) }
            else { widgetState = chatMessageReduce(state: widgetState, event: .streamEnd) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(roleLabels[role] ?? "") message")
    }

    private func handleCopy() {
        #if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
        #endif
        widgetState = chatMessageReduce(state: widgetState, event: .copy)
        onCopy?()
        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { _ in
            widgetState = chatMessageReduce(state: widgetState, event: .copyTimeout)
        }
    }
}
