#!/usr/bin/env python3
"""Generate SwiftUI widget implementations - Batch 3: llm-conversation"""
import os

BASE = "surface/widgets/swiftui/components/widgets/concepts"

def write_widget(suite, name, content):
    path = os.path.join(BASE, suite, f"{name}.swift")
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  Wrote {suite}/{name}.swift")

# ============================================================
# llm-conversation/ArtifactPanel
# ============================================================
write_widget("llm-conversation", "ArtifactPanel", r"""import SwiftUI

// MARK: - State Machine

enum ArtifactPanelState { case open, copied, fullscreen, closed }
enum ArtifactPanelEvent { case copy, fullscreen, close, versionChange, copyTimeout, exitFullscreen, openPanel }

func artifactPanelReduce(state: ArtifactPanelState, event: ArtifactPanelEvent) -> ArtifactPanelState {
    switch state {
    case .open:
        switch event {
        case .copy: return .copied
        case .fullscreen: return .fullscreen
        case .close: return .closed
        case .versionChange: return .open
        default: return state
        }
    case .copied:
        if case .copyTimeout = event { return .open }
        return state
    case .fullscreen:
        switch event {
        case .exitFullscreen: return .open
        case .close: return .closed
        default: return state
        }
    case .closed:
        if case .openPanel = event { return .open }
        return state
    }
}

// MARK: - Types

enum ArtifactType: String { case code, document, image, html }

private let typeIcons: [ArtifactType: String] = [.code: "\u{1F4BB}", .document: "\u{1F4C4}", .image: "\u{1F5BC}", .html: "\u{1F310}"]
private let typeLabels: [ArtifactType: String] = [.code: "Code", .document: "Document", .image: "Image", .html: "HTML"]

// MARK: - View

struct ArtifactPanelView: View {
    let content: String
    let artifactType: ArtifactType
    let title: String
    var language: String?
    var showVersions: Bool = true
    var currentVersion: Int = 1
    var totalVersions: Int = 1
    var onVersionChange: ((Int) -> Void)?
    var onClose: (() -> Void)?
    var onCopy: (() -> Void)?

    @State private var widgetState: ArtifactPanelState = .open
    @State private var copyTimer: Timer?

    private var showVersionBar: Bool { showVersions && totalVersions > 1 }

    var body: some View {
        if widgetState == .closed { EmptyView() }
        else {
            VStack(alignment: .leading, spacing: 0) {
                // Header
                HStack(spacing: 8) {
                    Text(typeIcons[artifactType] ?? "").font(.system(size: 12))
                    Text(typeLabels[artifactType] ?? "").font(.system(size: 12))
                    Text(title).fontWeight(.semibold).lineLimit(1)
                    Spacer()

                    Button(widgetState == .copied ? "Copied!" : "Copy") { handleCopy() }
                        .font(.caption)
                    Button(widgetState == .fullscreen ? "Exit Fullscreen" : "Fullscreen") {
                        widgetState = widgetState == .fullscreen
                            ? artifactPanelReduce(state: widgetState, event: .exitFullscreen)
                            : artifactPanelReduce(state: widgetState, event: .fullscreen)
                    }.font(.caption)
                    Button("Close") {
                        widgetState = artifactPanelReduce(state: widgetState, event: .close)
                        onClose?()
                    }.font(.caption)
                }
                .padding(.horizontal, 12).padding(.vertical, 8)

                // Version bar
                if showVersionBar {
                    HStack(spacing: 8) {
                        Button("\u{2039}") { if currentVersion > 1 { onVersionChange?(currentVersion - 1) } }
                            .disabled(currentVersion <= 1)
                        Text("Version \(currentVersion) of \(totalVersions)").font(.system(size: 12))
                        Button("\u{203A}") { if currentVersion < totalVersions { onVersionChange?(currentVersion + 1) } }
                            .disabled(currentVersion >= totalVersions)
                    }
                    .padding(.horizontal, 12).padding(.vertical, 4)
                }

                Divider()

                // Content
                ScrollView {
                    switch artifactType {
                    case .code:
                        VStack(alignment: .leading, spacing: 4) {
                            if let lang = language {
                                Text(lang.uppercased()).font(.system(size: 11)).foregroundColor(.secondary)
                            }
                            Text(content).font(.system(size: 13, design: .monospaced)).textSelection(.enabled)
                        }.padding(12)
                    case .document:
                        Text(content).font(.system(size: 14)).padding(16).textSelection(.enabled)
                    case .image:
                        // In a headless component, show the URL/path
                        Text(content).font(.system(size: 13)).foregroundColor(.secondary).padding(16)
                    case .html:
                        VStack(alignment: .leading, spacing: 8) {
                            Text("HTML preview is sandboxed.").font(.caption).foregroundColor(.secondary).italic()
                            Text(content).font(.system(size: 13, design: .monospaced)).textSelection(.enabled)
                        }.padding(12)
                    }
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Artifact: \(title)")
        }
    }

    private func handleCopy() {
        #if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
        #endif
        widgetState = artifactPanelReduce(state: widgetState, event: .copy)
        onCopy?()
        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: false) { _ in
            widgetState = artifactPanelReduce(state: widgetState, event: .copyTimeout)
        }
    }
}
""")

# ============================================================
# llm-conversation/ChatMessage
# ============================================================
write_widget("llm-conversation", "ChatMessage", r"""import SwiftUI

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
""")

# ============================================================
# llm-conversation/ConversationSidebar
# ============================================================
write_widget("llm-conversation", "ConversationSidebar", r"""import SwiftUI

// MARK: - Types

struct ConversationItem: Identifiable {
    let id: String
    let title: String
    let lastMessage: String
    let timestamp: String
    let messageCount: Int
    var isActive: Bool?
    var model: String?
    var tags: [String]?
    var folder: String?
}

enum ContextMenuAction: String, CaseIterable { case rename, delete, archive, share }

// MARK: - State Machine

enum ConversationSidebarState { case idle, searching, contextOpen }
enum ConversationSidebarEvent { case search, select, contextMenu, clearSearch, closeContext, action }

func conversationSidebarReduce(state: ConversationSidebarState, event: ConversationSidebarEvent) -> ConversationSidebarState {
    switch state {
    case .idle:
        switch event {
        case .search: return .searching
        case .select: return .idle
        case .contextMenu: return .contextOpen
        default: return state
        }
    case .searching:
        switch event {
        case .clearSearch: return .idle
        case .select: return .idle
        default: return state
        }
    case .contextOpen:
        switch event {
        case .closeContext, .action: return .idle
        default: return state
        }
    }
}

private func truncate(_ text: String, max: Int) -> String {
    text.count <= max ? text : String(text.prefix(max)) + "\u{2026}"
}

// MARK: - View

struct ConversationSidebarView: View {
    let conversations: [ConversationItem]
    var selectedId: String?
    var groupBy: String = "date"
    var showPreview: Bool = true
    var showModel: Bool = true
    var previewMaxLength: Int = 80
    var onSelect: ((String) -> Void)?
    var onCreate: (() -> Void)?
    var onDelete: ((String) -> Void)?
    var onContextAction: ((ContextMenuAction, String) -> Void)?

    @State private var widgetState: ConversationSidebarState = .idle
    @State private var searchQuery: String = ""

    private var filtered: [ConversationItem] {
        if searchQuery.trimmingCharacters(in: .whitespaces).isEmpty { return conversations }
        let q = searchQuery.lowercased()
        return conversations.filter { $0.title.lowercased().contains(q) || $0.lastMessage.lowercased().contains(q) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Search
            TextField("Search conversations\u{2026}", text: $searchQuery)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .onChange(of: searchQuery) { val in
                    if !val.trimmingCharacters(in: .whitespaces).isEmpty && widgetState != .searching {
                        widgetState = conversationSidebarReduce(state: widgetState, event: .search)
                    } else if val.trimmingCharacters(in: .whitespaces).isEmpty && widgetState == .searching {
                        widgetState = conversationSidebarReduce(state: widgetState, event: .clearSearch)
                    }
                }
                .accessibilityLabel("Search conversations")

            // New button
            Button("+ New conversation") { onCreate?() }
                .padding(.horizontal, 12).padding(.bottom, 8)
                .accessibilityLabel("New conversation")

            Divider()

            // List
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    ForEach(filtered) { item in
                        let isSelected = item.id == selectedId

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(item.title).fontWeight(.medium).lineLimit(1)
                                Spacer()
                                Text(item.timestamp).font(.caption2).foregroundColor(.secondary)
                            }

                            if showPreview {
                                Text(truncate(item.lastMessage, max: previewMaxLength))
                                    .font(.caption).foregroundColor(.secondary).lineLimit(2)
                            }

                            HStack {
                                Text("\(item.messageCount) msg\(item.messageCount != 1 ? "s" : "")").font(.caption2).foregroundColor(.secondary)
                                if showModel, let m = item.model {
                                    Text(m).font(.caption2).padding(.horizontal, 4).padding(.vertical, 1)
                                        .background(Color.gray.opacity(0.12)).cornerRadius(3)
                                }
                                Spacer()
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            widgetState = conversationSidebarReduce(state: widgetState, event: .select)
                            searchQuery = ""
                            onSelect?(item.id)
                        }
                        .contextMenu {
                            ForEach(ContextMenuAction.allCases, id: \.self) { action in
                                Button(action.rawValue.capitalized) {
                                    if action == .delete { onDelete?(item.id) }
                                    onContextAction?(action, item.id)
                                }
                            }
                        }
                        .accessibilityLabel("\(item.title)")
                    }

                    if filtered.isEmpty {
                        Text(searchQuery.isEmpty ? "No conversations yet." : "No conversations match your search.")
                            .font(.caption).foregroundColor(.secondary).padding(12)
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Conversation history")
    }
}
""")

# ============================================================
# llm-conversation/InlineCitation
# ============================================================
write_widget("llm-conversation", "InlineCitation", r"""import SwiftUI

// MARK: - State Machine

enum InlineCitationState { case idle, previewing, navigating }
enum InlineCitationEvent { case hover, leave, navigate, close }

func inlineCitationReduce(state: InlineCitationState, event: InlineCitationEvent) -> InlineCitationState {
    switch state {
    case .idle:
        switch event {
        case .hover: return .previewing
        case .navigate: return .navigating
        default: return state
        }
    case .previewing:
        switch event {
        case .leave: return .idle
        case .navigate: return .navigating
        default: return state
        }
    case .navigating:
        if case .close = event { return .idle }
        return state
    }
}

// MARK: - View

struct InlineCitationView: View {
    let label: String
    let sourceTitle: String
    let sourceUrl: String
    var snippet: String?
    var index: Int?
    var onNavigate: (() -> Void)?

    @State private var widgetState: InlineCitationState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: {
                widgetState = inlineCitationReduce(state: widgetState, event: .navigate)
                onNavigate?()
            }) {
                HStack(spacing: 4) {
                    if let idx = index {
                        Text("[\(idx)]").font(.system(size: 11)).foregroundColor(.blue)
                    }
                    Text(label).font(.system(size: 13)).foregroundColor(.blue).underline()
                }
            }
            .buttonStyle(.plain)
            .onHover { h in
                widgetState = h
                    ? inlineCitationReduce(state: widgetState, event: .hover)
                    : inlineCitationReduce(state: widgetState, event: .leave)
            }
            .accessibilityLabel("Citation: \(label)")

            if widgetState == .previewing {
                VStack(alignment: .leading, spacing: 4) {
                    Text(sourceTitle).font(.system(size: 12, weight: .semibold))
                    Text(sourceUrl).font(.system(size: 11)).foregroundColor(.secondary)
                    if let snip = snippet {
                        Text(snip).font(.system(size: 11)).foregroundColor(.secondary).lineLimit(3)
                    }
                }
                .padding(8)
                .background(Color(.darkGray))
                .foregroundColor(.white)
                .cornerRadius(6)
                .padding(.top, 4)
            }
        }
    }
}
""")

# ============================================================
# llm-conversation/MessageBranchNav
# ============================================================
write_widget("llm-conversation", "MessageBranchNav", r"""import SwiftUI

// MARK: - State Machine

enum MessageBranchNavState { case viewing, editing }
enum MessageBranchNavEvent { case edit, save, cancel, prev, next }

func messageBranchNavReduce(state: MessageBranchNavState, event: MessageBranchNavEvent) -> MessageBranchNavState {
    switch state {
    case .viewing:
        switch event {
        case .edit: return .editing
        case .prev, .next: return .viewing
        default: return state
        }
    case .editing:
        switch event {
        case .save, .cancel: return .viewing
        default: return state
        }
    }
}

// MARK: - View

struct MessageBranchNavView: View {
    let currentIndex: Int
    let totalBranches: Int
    var onPrevious: (() -> Void)?
    var onNext: (() -> Void)?
    var onEdit: (() -> Void)?
    var onSave: ((String) -> Void)?

    @State private var widgetState: MessageBranchNavState = .viewing
    @State private var editText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                Button("\u{25C0}") {
                    widgetState = messageBranchNavReduce(state: widgetState, event: .prev)
                    onPrevious?()
                }
                .disabled(currentIndex <= 1)
                .accessibilityLabel("Previous branch")

                Text("\(currentIndex) / \(totalBranches)")
                    .font(.system(size: 13)).monospacedDigit()
                    .accessibilityLabel("Branch \(currentIndex) of \(totalBranches)")

                Button("\u{25B6}") {
                    widgetState = messageBranchNavReduce(state: widgetState, event: .next)
                    onNext?()
                }
                .disabled(currentIndex >= totalBranches)
                .accessibilityLabel("Next branch")

                Spacer()

                if widgetState == .viewing {
                    Button("Edit") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .edit)
                        onEdit?()
                    }.font(.caption)
                }
            }

            if widgetState == .editing {
                TextEditor(text: $editText)
                    .font(.system(size: 13))
                    .frame(minHeight: 60)
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.gray.opacity(0.3)))

                HStack {
                    Button("Save") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .save)
                        onSave?(editText)
                    }.font(.caption)
                    Button("Cancel") {
                        widgetState = messageBranchNavReduce(state: widgetState, event: .cancel)
                    }.font(.caption)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Message branch navigation")
    }
}
""")

# ============================================================
# llm-conversation/PromptInput
# ============================================================
write_widget("llm-conversation", "PromptInput", r"""import SwiftUI

// MARK: - State Machine

enum PromptInputState { case empty, composing, submitting }
enum PromptInputEvent { case input, clear, submit, complete }

func promptInputReduce(state: PromptInputState, event: PromptInputEvent) -> PromptInputState {
    switch state {
    case .empty:
        if case .input = event { return .composing }
        return state
    case .composing:
        switch event {
        case .clear: return .empty
        case .submit: return .submitting
        default: return state
        }
    case .submitting:
        if case .complete = event { return .empty }
        return state
    }
}

// MARK: - View

struct PromptInputView: View {
    var placeholder: String = "Type a message\u{2026}"
    var maxLength: Int?
    var showCharCount: Bool = false
    var disabled: Bool = false
    var onSubmit: ((String) -> Void)?
    var onChange: ((String) -> Void)?

    @State private var widgetState: PromptInputState = .empty
    @State private var text: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 8) {
                TextEditor(text: $text)
                    .font(.system(size: 14))
                    .frame(minHeight: 36, maxHeight: 120)
                    .overlay(
                        Group {
                            if text.isEmpty {
                                Text(placeholder).foregroundColor(.secondary).font(.system(size: 14))
                                    .padding(.horizontal, 4).padding(.vertical, 8)
                                    .allowsHitTesting(false)
                            }
                        },
                        alignment: .topLeading
                    )
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
                    .disabled(disabled || widgetState == .submitting)
                    .onChange(of: text) { val in
                        if val.isEmpty && widgetState == .composing {
                            widgetState = promptInputReduce(state: widgetState, event: .clear)
                        } else if !val.isEmpty && widgetState == .empty {
                            widgetState = promptInputReduce(state: widgetState, event: .input)
                        }
                        if let ml = maxLength, val.count > ml { text = String(val.prefix(ml)) }
                        onChange?(text)
                    }
                    .accessibilityLabel("Message input")

                Button(action: handleSubmit) {
                    Text(widgetState == .submitting ? "\u{2026}" : "\u{2191}")
                        .font(.system(size: 18))
                        .frame(width: 36, height: 36)
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || disabled || widgetState == .submitting)
                .accessibilityLabel("Send message")
            }

            if showCharCount {
                HStack {
                    Spacer()
                    Text(maxLength != nil ? "\(text.count)/\(maxLength!)" : "\(text.count)")
                        .font(.caption2).foregroundColor(.secondary)
                }
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Prompt input")
    }

    private func handleSubmit() {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        widgetState = promptInputReduce(state: widgetState, event: .submit)
        onSubmit?(trimmed)
        text = ""
        widgetState = promptInputReduce(state: widgetState, event: .complete)
    }
}
""")

# ============================================================
# llm-conversation/StreamText
# ============================================================
write_widget("llm-conversation", "StreamText", r"""import SwiftUI

// MARK: - State Machine

enum StreamTextState { case idle, streaming, complete, stopped }
enum StreamTextEvent { case streamStart, token, streamEnd, stop, reset }

func streamTextReduce(state: StreamTextState, event: StreamTextEvent) -> StreamTextState {
    switch state {
    case .idle:
        if case .streamStart = event { return .streaming }
        return state
    case .streaming:
        switch event {
        case .token: return .streaming
        case .streamEnd: return .complete
        case .stop: return .stopped
        default: return state
        }
    case .complete:
        if case .reset = event { return .idle }
        return state
    case .stopped:
        if case .reset = event { return .idle }
        return state
    }
}

// MARK: - View

struct StreamTextView: View {
    let content: String
    var isStreaming: Bool = false
    var showCursor: Bool = true
    var speed: String = "normal"
    var onStop: (() -> Void)?
    var onComplete: (() -> Void)?

    @State private var widgetState: StreamTextState = .idle

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .bottom, spacing: 0) {
                Text(content).font(.system(size: 14)).textSelection(.enabled)

                if widgetState == .streaming && showCursor {
                    Rectangle().fill(Color.primary).frame(width: 2, height: 16).opacity(0.7)
                }
            }

            if widgetState == .streaming {
                Button("Stop") {
                    widgetState = streamTextReduce(state: widgetState, event: .stop)
                    onStop?()
                }.font(.caption).accessibilityLabel("Stop streaming")
            }

            if widgetState == .complete {
                Text("Complete").font(.caption2).foregroundColor(.green)
            }
        }
        .onAppear {
            if isStreaming { widgetState = streamTextReduce(state: widgetState, event: .streamStart) }
        }
        .onChange(of: isStreaming) { s in
            if s && widgetState == .idle {
                widgetState = streamTextReduce(state: widgetState, event: .streamStart)
            } else if !s && widgetState == .streaming {
                widgetState = streamTextReduce(state: widgetState, event: .streamEnd)
                onComplete?()
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Streaming text")
    }
}
""")

print("\nDone with llm-conversation (7 widgets)")
