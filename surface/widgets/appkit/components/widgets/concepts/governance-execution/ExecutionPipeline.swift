import AppKit

class ExecutionPipelineView: NSView {
    enum State: String { case idle; case stageSelected; case failed }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Horizontal pipeline visualization showin")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, pipeline, stage, stageIcon, stageLabel, stageDetail, connector, timelockTimer, actionBar
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
