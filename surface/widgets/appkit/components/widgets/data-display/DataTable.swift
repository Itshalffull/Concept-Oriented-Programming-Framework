// ============================================================
// Clef Surface AppKit Widget — DataTable
//
// Full-featured data table with sortable columns, row
// selection, and scrolling. Wraps NSTableView.
// ============================================================

import AppKit

public class ClefDataTableView: NSView {
    public struct Column {
        public let id: String
        public let title: String
        public let width: CGFloat
        public init(id: String, title: String, width: CGFloat = 120) {
            self.id = id; self.title = title; self.width = width
        }
    }

    public var columns: [Column] = [] { didSet { rebuildColumns() } }
    public var rows: [[String: String]] = [] { didSet { tableView.reloadData() } }
    public var onRowSelect: ((Int) -> Void)?
    public var sortable: Bool = true

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
        tableView.dataSource = self
        tableView.delegate = self
        tableView.usesAlternatingRowBackgroundColors = true
        tableView.allowsColumnReordering = true
        tableView.gridStyleMask = [.solidHorizontalGridLineMask]

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        addSubview(scrollView)
    }

    private func rebuildColumns() {
        tableView.tableColumns.forEach { tableView.removeTableColumn($0) }
        for col in columns {
            let tc = NSTableColumn(identifier: NSUserInterfaceItemIdentifier(col.id))
            tc.title = col.title
            tc.width = col.width
            if sortable {
                tc.sortDescriptorPrototype = NSSortDescriptor(key: col.id, ascending: true)
            }
            tableView.addTableColumn(tc)
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}

extension ClefDataTableView: NSTableViewDataSource, NSTableViewDelegate {
    public func numberOfRows(in tableView: NSTableView) -> Int { rows.count }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let colId = tableColumn?.identifier.rawValue else { return nil }
        let cell = NSTextField(labelWithString: rows[row][colId] ?? "")
        cell.font = NSFont.systemFont(ofSize: 12)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        if row >= 0 { onRowSelect?(row) }
    }

    public func tableView(_ tableView: NSTableView, sortDescriptorsDidChange oldDescriptors: [NSSortDescriptor]) {
        guard let sd = tableView.sortDescriptors.first, let key = sd.key else { return }
        rows.sort { a, b in
            let va = a[key] ?? ""
            let vb = b[key] ?? ""
            return sd.ascending ? va < vb : va > vb
        }
        tableView.reloadData()
    }
}
