import AppKit

class VerificationStatusBadgeView: NSView {
    enum State: String { case idle; case hovered; case animating }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Compact status indicator for formal veri")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, icon, label, tooltip
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
