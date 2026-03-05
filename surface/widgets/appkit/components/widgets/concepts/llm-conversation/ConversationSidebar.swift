import AppKit

class ConversationSidebarView: NSView {
    enum State: String { case idle; case searching; case contextOpen }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Sidebar panel listing conversation histo")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, searchInput, newButton, groupList, groupHeader, conversationItem, itemTitle, itemPreview, itemTimestamp, itemModel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
