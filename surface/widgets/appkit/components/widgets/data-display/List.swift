// ============================================================
// Clef Surface AppKit Widget — List
//
// Scrollable list of items with selection support.
// Wraps NSTableView in single-column mode.
// ============================================================

import AppKit

public class ClefListView: NSView {
    public var items: [String] = [] { didSet { tableView.reloadData() } }
    public var onSelect: ((Int) -> Void)?
    public var allowsMultipleSelection: Bool = false { didSet { tableView.allowsMultipleSelection = allowsMultipleSelection } }

    private let scrollView = NSScrollView()
    private let tableView = NSTableView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("item"))
        col.title = ""
        tableView.addTableColumn(col)
        tableView.headerView = nil
        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 32

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        addSubview(scrollView)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

extension ClefListView: NSTableViewDataSource, NSTableViewDelegate {
    public func numberOfRows(in tableView: NSTableView) -> Int { items.count }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let cell = NSTextField(labelWithString: items[row])
        cell.font = NSFont.systemFont(ofSize: 13)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        if row >= 0 { onSelect?(row) }
    }
}
