import AppKit

class ProposalCardView: NSView {
    enum State: String { case idle; case hovered; case focused; case navigating }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Compact navigation card summarizing a go")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, statusBadge, title, description, proposer, voteBar, quorumGauge, timeRemaining, action
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
