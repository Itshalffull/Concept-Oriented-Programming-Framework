import AppKit

class MessageActionsView: NSView {
    enum State: String { case hidden; case visible; case copied }
    private var state: State = .hidden

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hover-revealed toolbar for chat message ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, thumbsUp, thumbsDown, copyButton, regenerate, editButton, shareButton, moreButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
