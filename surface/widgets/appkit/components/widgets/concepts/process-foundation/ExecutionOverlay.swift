import AppKit

class ExecutionOverlayView: NSView {
    enum State: String { case idle; case live; case suspended; case completed; case failed; case cancelled; case replay }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Runtime state overlay for process execut")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, nodeOverlay, activeMarker, flowAnimation, statusBar, controlButtons, elapsedTime, errorBanner
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
