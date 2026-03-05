import AppKit

class ToolCallDetailView: NSView {
    enum State: String { case idle; case retrying }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Detailed view of a single tool call with")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, toolName, statusBadge, argumentsPanel, resultPanel, timingBar, tokenBadge, errorPanel, retryButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
