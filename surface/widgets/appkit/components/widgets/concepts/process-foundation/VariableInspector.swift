import AppKit

class VariableInspectorView: NSView {
    enum State: String { case idle; case filtering; case varSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Key-value inspector panel for process ru")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, searchBar, variableList, variableItem, varName, varType, varValue, watchList
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
