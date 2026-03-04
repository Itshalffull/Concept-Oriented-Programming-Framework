// ============================================================
// Clef Surface AppKit Widget — CommandPalette
//
// Searchable command launcher overlay (Cmd+K style). Filters
// commands by fuzzy match and executes on selection.
// ============================================================

import AppKit

public class ClefCommandPaletteView: NSView, NSTextFieldDelegate {
    public struct Command {
        public let id: String
        public let title: String
        public let subtitle: String
        public let icon: String?
        public let shortcut: String
        public let action: () -> Void

        public init(id: String, title: String, subtitle: String = "", icon: String? = nil, shortcut: String = "", action: @escaping () -> Void) {
            self.id = id; self.title = title; self.subtitle = subtitle; self.icon = icon; self.shortcut = shortcut; self.action = action
        }
    }

    public var commands: [Command] = []
    public var onDismiss: (() -> Void)?

    private let searchField = NSTextField()
    private let scrollView = NSScrollView()
    private let tableView = NSTableView()
    private var filteredCommands: [Command] = []

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        layer?.cornerRadius = 12
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = 0.2
        layer?.shadowRadius = 20

        searchField.placeholderString = "Type a command..."
        searchField.font = NSFont.systemFont(ofSize: 16)
        searchField.isBezeled = false
        searchField.focusRingType = .none
        searchField.delegate = self
        addSubview(searchField)

        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("command"))
        col.title = ""
        tableView.addTableColumn(col)
        tableView.headerView = nil
        tableView.rowHeight = 40
        tableView.dataSource = self
        tableView.delegate = self

        scrollView.documentView = tableView
        scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    public func show() {
        filteredCommands = commands
        tableView.reloadData()
        isHidden = false
        window?.makeFirstResponder(searchField)
    }

    public func dismiss() {
        isHidden = true
        searchField.stringValue = ""
        onDismiss?()
    }

    public func controlTextDidChange(_ obj: Notification) {
        let query = searchField.stringValue.lowercased()
        filteredCommands = query.isEmpty ? commands : commands.filter { $0.title.lowercased().contains(query) }
        tableView.reloadData()
    }

    public override func layout() {
        super.layout()
        searchField.frame = NSRect(x: 16, y: bounds.height - 48, width: bounds.width - 32, height: 32)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 56)
    }
}

extension ClefCommandPaletteView: NSTableViewDataSource, NSTableViewDelegate {
    public func numberOfRows(in tableView: NSTableView) -> Int { filteredCommands.count }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let cmd = filteredCommands[row]
        let cell = NSTextField(labelWithString: cmd.title)
        cell.font = NSFont.systemFont(ofSize: 14)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        guard row >= 0 && row < filteredCommands.count else { return }
        filteredCommands[row].action()
        dismiss()
    }
}
