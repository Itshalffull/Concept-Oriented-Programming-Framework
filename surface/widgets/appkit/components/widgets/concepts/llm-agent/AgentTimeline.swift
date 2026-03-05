import AppKit

class AgentTimelineView: NSView {
    enum State: String { case idle; case entrySelected; case interrupted; case inactive; case active }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-agent communication timeline displ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, timeline, entry, agentBadge, typeBadge, content, timestamp, delegation, interruptButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
