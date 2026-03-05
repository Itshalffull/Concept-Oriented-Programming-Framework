import AppKit

class PromptEditorView: NSView {
    enum State: String { case editing; case testing; case viewing }
    private var state: State = .editing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-message prompt template editor for")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, systemBlock, userBlock, variablePills, modelBadge, tokenCount, testButton, testPanel, toolList
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
