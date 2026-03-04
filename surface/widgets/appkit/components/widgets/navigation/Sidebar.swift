// ============================================================
// Clef Surface AppKit Widget — Sidebar
//
// Vertical navigation sidebar with collapsible sections and
// icon+label items. Uses NSOutlineView for tree structure.
// ============================================================

import AppKit

public class ClefSidebarView: NSView {
    public struct SidebarItem {
        public let id: String
        public let label: String
        public let icon: String?
        public let children: [SidebarItem]
        public init(id: String, label: String, icon: String? = nil, children: [SidebarItem] = []) {
            self.id = id; self.label = label; self.icon = icon; self.children = children
        }
    }

    public var items: [SidebarItem] = [] { didSet { outlineView.reloadData() } }
    public var onSelectionChange: ((String) -> Void)?

    private let scrollView = NSScrollView()
    private let outlineView = NSOutlineView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("sidebar"))
        col.title = ""
        outlineView.addTableColumn(col)
        outlineView.outlineTableColumn = col
        outlineView.headerView = nil
        outlineView.dataSource = self
        outlineView.delegate = self
        outlineView.rowHeight = 28

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

extension ClefSidebarView: NSOutlineViewDataSource, NSOutlineViewDelegate {
    public func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        if let si = item as? SidebarItem { return si.children.count }
        return items.count
    }

    public func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        if let si = item as? SidebarItem { return si.children[index] }
        return items[index]
    }

    public func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        (item as? SidebarItem)?.children.isEmpty == false
    }

    public func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let si = item as? SidebarItem else { return nil }
        let cell = NSTableCellView()
        let tf = NSTextField(labelWithString: si.label)
        tf.font = NSFont.systemFont(ofSize: 13)
        cell.addSubview(tf)
        cell.textField = tf
        if let iconName = si.icon, let img = NSImage(systemSymbolName: iconName, accessibilityDescription: nil) {
            let iv = NSImageView(image: img)
            iv.frame = NSRect(x: 0, y: 4, width: 16, height: 16)
            cell.addSubview(iv)
            cell.imageView = iv
            tf.frame.origin.x = 22
        }
        return cell
    }

    public func outlineViewSelectionDidChange(_ notification: Notification) {
        guard let item = outlineView.item(atRow: outlineView.selectedRow) as? SidebarItem else { return }
        onSelectionChange?(item.id)
    }
}
