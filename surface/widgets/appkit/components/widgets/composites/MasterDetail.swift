// ============================================================
// Clef Surface AppKit Widget — MasterDetail
//
// Split view with a master list on the left and a detail
// panel on the right. Selection in master drives detail.
// ============================================================

import AppKit

public class ClefMasterDetailView: NSSplitView {
    public var items: [String] = [] { didSet { tableView.reloadData() } }
    public var onSelectionChange: ((Int) -> Void)?

    private let masterScroll = NSScrollView()
    private let tableView = NSTableView()
    private let detailView = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        isVertical = true
        dividerStyle = .thin

        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("master"))
        col.title = ""
        tableView.addTableColumn(col)
        tableView.headerView = nil
        tableView.dataSource = self
        tableView.delegate = self
        masterScroll.documentView = tableView
        masterScroll.hasVerticalScroller = true

        addArrangedSubview(masterScroll)
        addArrangedSubview(detailView)
        setPosition(240, ofDividerAt: 0)
    }

    public func setDetail(_ view: NSView) {
        detailView.subviews.forEach { $0.removeFromSuperview() }
        detailView.addSubview(view)
        view.frame = detailView.bounds
    }
}

extension ClefMasterDetailView: NSTableViewDataSource, NSTableViewDelegate {
    public func numberOfRows(in tableView: NSTableView) -> Int { items.count }
    public func tableView(_ tv: NSTableView, viewFor tc: NSTableColumn?, row: Int) -> NSView? {
        let cell = NSTextField(labelWithString: items[row])
        cell.font = NSFont.systemFont(ofSize: 13)
        return cell
    }
    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        if row >= 0 { onSelectionChange?(row) }
    }
}
