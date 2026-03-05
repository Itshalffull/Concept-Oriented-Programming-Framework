import AppKit

class MessageBranchNavView: NSView {
    enum State: String { case viewing; case editing }
    private var state: State = .viewing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Navigation control for conversation bran")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, prevButton, indicator, nextButton, editButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
