import AppKit

class TraceStepControlsView: NSView {
    enum State: String { case paused; case playing }
    private var state: State = .paused

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Playback control toolbar for navigating ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, jumpStart, stepBack, playPause, stepFwd, jumpEnd, stepCounter, speedControl
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
