import AppKit

class TraceTimelineViewerView: NSView {
    enum State: String { case idle; case playing; case cellSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Horizontal timeline visualization of ver")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, timeAxis, lanes, lane, laneLabel, cell, stepCursor, controls, zoomControl
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
