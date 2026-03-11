// ============================================================
// Clef Surface AppKit Widget — TreeSelect
//
// Hierarchical dropdown selection using NSOutlineView in a
// popover. Supports parent/child node expansion.
// ============================================================

import AppKit

public class ClefTreeSelectView: NSView {
    public class TreeNode {
        public let id: String
        public let label: String
        public var children: [TreeNode]
        public init(id: String, label: String, children: [TreeNode] = []) {
            self.id = id; self.label = label; self.children = children
        }
    }

    public var nodes: [TreeNode] = []
    public var selectedId: String? { didSet { updateButtonTitle() } }
    public var placeholder: String = "Select..."
    public var onSelectionChange: ((String) -> Void)?

    private let button = NSButton()
    private let popover = NSPopover()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        button.bezelStyle = .rounded
        button.title = placeholder
        button.target = self
        button.action = #selector(showPopover)
        addSubview(button)
    }

    private func updateButtonTitle() {
        func find(_ id: String, in items: [TreeNode]) -> TreeNode? {
            for node in items {
                if node.id == id { return node }
                if let found = find(id, in: node.children) { return found }
            }
            return nil
        }
        if let id = selectedId, let node = find(id, in: nodes) {
            button.title = node.label
        } else {
            button.title = placeholder
        }
    }

    @objc private func showPopover() {
        let vc = NSViewController()
        let outlineView = NSOutlineView()
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("tree"))
        col.title = ""
        outlineView.addTableColumn(col)
        outlineView.outlineTableColumn = col
        outlineView.headerView = nil

        let scrollView = NSScrollView(frame: NSRect(x: 0, y: 0, width: 250, height: 200))
        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        vc.view = scrollView

        popover.contentViewController = vc
        popover.behavior = .transient
        popover.show(relativeTo: button.bounds, of: button, preferredEdge: .maxY)
    }

    public override func layout() {
        super.layout()
        button.frame = bounds
    }
}
