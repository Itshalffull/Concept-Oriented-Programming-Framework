import AppKit

class SlaTimerView: NSView {
    enum State: String { case onTrack; case warning; case critical; case breached; case paused }
    private var state: State = .onTrack

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Five-state countdown timer for service l")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, countdownText, phaseLabel, progressBar, elapsedText
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
