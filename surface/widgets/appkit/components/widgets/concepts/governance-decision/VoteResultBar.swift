import AppKit

class VoteResultBarView: NSView {
    enum State: String { case idle; case animating; case segmentHovered }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Horizontal segmented bar visualizing vot")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, bar, segment, segmentLabel, quorumMarker, totalLabel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
