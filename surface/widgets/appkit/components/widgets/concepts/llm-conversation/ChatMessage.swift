import AppKit

class ChatMessageView: NSView {
    enum State: String { case idle; case hovered; case copied }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Role-differentiated message container fo")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, avatar, roleLabel, body, timestamp, actions, copyButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
