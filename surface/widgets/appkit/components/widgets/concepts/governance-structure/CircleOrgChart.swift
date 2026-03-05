import AppKit

class CircleOrgChartView: NSView {
    enum State: String { case idle; case circleSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hierarchical organization chart showing ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, circleNode, circleLabel, memberAvatars, policyBadges, jurisdictionTag, children, detailPanel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
