import AppKit

class GuardrailConfigView: NSView {
    enum State: String { case viewing; case ruleSelected; case testing; case adding }
    private var state: State = .viewing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Configuration panel for safety guardrail")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, ruleList, ruleItem, ruleToggle, ruleName, ruleSeverity, ruleHistory, addButton, testPanel, testInput, testResult
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
