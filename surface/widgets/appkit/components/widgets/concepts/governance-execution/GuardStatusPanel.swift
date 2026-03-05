import AppKit

class GuardStatusPanelView: NSView {
    enum State: String { case idle; case guardSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Panel displaying all active guards for a")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, guardList, guardItem, guardIcon, guardName, guardCondition, guardStatus, blockingBanner
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
