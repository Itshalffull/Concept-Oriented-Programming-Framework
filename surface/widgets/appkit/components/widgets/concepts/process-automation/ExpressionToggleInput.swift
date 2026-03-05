import AppKit

class ExpressionToggleInputView: NSView {
    enum State: String { case fixed; case expression; case autocompleting }
    private var state: State = .fixed

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Dual-mode input field that switches betw")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, modeToggle, fixedInput, expressionInput, autocomplete, preview
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
