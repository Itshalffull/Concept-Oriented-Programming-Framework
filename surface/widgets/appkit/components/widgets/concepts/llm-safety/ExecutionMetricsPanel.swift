import AppKit

class ExecutionMetricsPanelView: NSView {
    enum State: String { case idle; case updating }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Dashboard panel displaying LLM execution")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, stepCounter, tokenGauge, costDisplay, latencyCard, errorRate
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
