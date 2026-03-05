import AppKit

class ReasoningBlockView: NSView {
    enum State: String { case collapsed; case expanded }
    private var state: State = .collapsed

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Collapsible display for LLM chain-of-tho")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, headerIcon, headerText, body, duration
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
