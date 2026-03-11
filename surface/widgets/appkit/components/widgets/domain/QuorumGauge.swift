import AppKit

class QuorumGaugeView: NSView {
    enum State: String { case belowThreshold; case atThreshold; case aboveThreshold }
    private var state: State = .belowThreshold

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Progress bar with a threshold marker sho")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, progressBar, fill, thresholdMarker, currentLabel, thresholdLabel, statusBadge
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
