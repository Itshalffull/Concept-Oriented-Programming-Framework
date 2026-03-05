import AppKit

class MemoryInspectorView: NSView {
    enum State: String { case viewing; case searching; case entrySelected; case deleting }
    private var state: State = .viewing

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Inspector panel for viewing and managing")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, tabs, workingView, entryItem, entryLabel, entryContent, entryMeta, searchBar, contextBar, deleteButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
