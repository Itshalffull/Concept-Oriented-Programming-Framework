import AppKit

class PromptTemplateEditorView: NSView {
    enum State: String { case editing; case messageSelected; case compiling }
    private var state: State = .editing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-message prompt template editor wit")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, messageList, messageBlock, roleSelector, templateInput, variablePills, addButton, reorderHandle, deleteButton, parameterPanel, tokenCount
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
