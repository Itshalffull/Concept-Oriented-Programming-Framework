import AppKit

class ToolInvocationView: NSView {
    enum State: String { case collapsed; case hoveredCollapsed; case expanded; case pending; case running; case succeeded; case failed }
    private var state: State = .collapsed

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Collapsible card displaying an LLM tool ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, toolIcon, toolName, statusIcon, durationLabel, body, argumentsBlock, resultBlock, warningBadge, retryButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
