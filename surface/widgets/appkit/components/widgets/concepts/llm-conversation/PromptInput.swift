import AppKit

class PromptInputView: NSView {
    enum State: String { case empty; case composing; case submitting }
    private var state: State = .empty

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Auto-expanding textarea for composing LL")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, textarea, attachButton, modelSelector, counter, submitButton, toolbar
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
