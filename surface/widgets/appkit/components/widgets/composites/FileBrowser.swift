// ============================================================
// Clef Surface AppKit Widget — FileBrowser
//
// Hierarchical file/folder browser with tree navigation,
// file icons, and selection. Uses NSOutlineView.
// ============================================================

import AppKit

public class ClefFileBrowserView: NSView {
    public class FileNode {
        public let name: String
        public let isDirectory: Bool
        public var children: [FileNode]
        public init(name: String, isDirectory: Bool, children: [FileNode] = []) {
            self.name = name; self.isDirectory = isDirectory; self.children = children
        }
    }

    public var rootNodes: [FileNode] = [] { didSet { outlineView.reloadData() } }
    public var onSelect: ((FileNode) -> Void)?

    private let scrollView = NSScrollView()
    private let outlineView = NSOutlineView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("file"))
        col.title = "Name"
        outlineView.addTableColumn(col)
        outlineView.outlineTableColumn = col
        outlineView.headerView = nil
        outlineView.dataSource = self
        outlineView.delegate = self
        outlineView.rowHeight = 22
        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

extension ClefFileBrowserView: NSOutlineViewDataSource, NSOutlineViewDelegate {
    public func outlineView(_ ov: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        if let node = item as? FileNode { return node.children.count }
        return rootNodes.count
    }
    public func outlineView(_ ov: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        if let node = item as? FileNode { return node.children[index] }
        return rootNodes[index]
    }
    public func outlineView(_ ov: NSOutlineView, isItemExpandable item: Any) -> Bool {
        (item as? FileNode)?.isDirectory ?? false
    }
    public func outlineView(_ ov: NSOutlineView, viewFor tc: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? FileNode else { return nil }
        let cell = NSTableCellView()
        let iconName = node.isDirectory ? "folder.fill" : "doc.text"
        let iv = NSImageView(image: NSImage(systemSymbolName: iconName, accessibilityDescription: nil) ?? NSImage())
        iv.frame = NSRect(x: 0, y: 2, width: 16, height: 16)
        let tf = NSTextField(labelWithString: node.name)
        tf.font = NSFont.systemFont(ofSize: 12)
        tf.frame.origin.x = 20
        cell.addSubview(iv)
        cell.addSubview(tf)
        cell.textField = tf
        cell.imageView = iv
        return cell
    }
    public func outlineViewSelectionDidChange(_ notification: Notification) {
        guard let node = outlineView.item(atRow: outlineView.selectedRow) as? FileNode else { return }
        onSelect?(node)
    }
}
