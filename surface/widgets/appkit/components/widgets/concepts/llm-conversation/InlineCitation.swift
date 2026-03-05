import AppKit

class InlineCitationView: NSView {
    enum State: String { case idle; case previewing; case navigating }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Numbered inline citation reference rende")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, badge, tooltip, title, excerpt, link
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
