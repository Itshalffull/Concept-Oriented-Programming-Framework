import AppKit

class DelegationGraphView: NSView {
    enum State: String { case browsing; case searching; case selected; case delegating; case undelegating }
    private var state: State = .browsing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Interactive visualization of delegation ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, searchInput, sortControl, viewToggle, delegateList, delegateItem, avatar, delegateName, votingPower, participation, delegateAction, currentInfo, graphView
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
