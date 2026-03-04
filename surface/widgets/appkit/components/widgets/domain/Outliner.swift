// ============================================================
// Clef Surface AppKit Widget — Outliner
//
// Hierarchical outline editor with indented items, expand/
// collapse, and drag reordering. Uses NSOutlineView.
// ============================================================

import AppKit

public class ClefOutlinerView: NSView {
    public class OutlineItem {
        public let id: String
        public var text: String
        public var children: [OutlineItem]
        public init(id: String, text: String, children: [OutlineItem] = []) {
            self.id = id; self.text = text; self.children = children
        }
    }

    public var items: [OutlineItem] = [] { didSet { outlineView.reloadData() } }
    public var onItemChange: ((String, String) -> Void)?

    private let scrollView = NSScrollView()
    private let outlineView = NSOutlineView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("outline"))
        col.title = ""; outlineView.addTableColumn(col); outlineView.outlineTableColumn = col
        outlineView.headerView = nil; outlineView.dataSource = self; outlineView.delegate = self
        outlineView.rowHeight = 24
        scrollView.documentView = outlineView; scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    public override func layout() { super.layout(); scrollView.frame = bounds }
}

extension ClefOutlinerView: NSOutlineViewDataSource, NSOutlineViewDelegate {
    public func outlineView(_ ov: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        (item as? OutlineItem)?.children.count ?? items.count
    }
    public func outlineView(_ ov: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        (item as? OutlineItem)?.children[index] ?? items[index]
    }
    public func outlineView(_ ov: NSOutlineView, isItemExpandable item: Any) -> Bool {
        !((item as? OutlineItem)?.children.isEmpty ?? true)
    }
    public func outlineView(_ ov: NSOutlineView, viewFor tc: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? OutlineItem else { return nil }
        let tf = NSTextField(string: node.text); tf.font = NSFont.systemFont(ofSize: 13)
        tf.isEditable = true; tf.isBezeled = false; tf.drawsBackground = false
        return tf
    }
}
