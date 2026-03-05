import AppKit

class DependencyTreeView: NSView {
    enum State: String { case idle; case nodeSelected; case filtering }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Interactive dependency tree viewer for p")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, searchBar, scopeFilter, tree, treeNode, packageName, versionBadge, conflictIcon, vulnIcon, dupBadge, detailPanel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
