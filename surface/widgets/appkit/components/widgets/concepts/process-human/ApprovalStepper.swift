import AppKit

class ApprovalStepperView: NSView {
    enum State: String { case viewing; case stepFocused; case acting }
    private var state: State = .viewing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-step approval flow visualization s")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, stepList, step, stepIndicator, stepLabel, stepAssignee, stepStatus, stepTimestamp, connector, actionBar, slaIndicator
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
