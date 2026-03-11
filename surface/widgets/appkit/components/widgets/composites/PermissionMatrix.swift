// ============================================================
// Clef Surface AppKit Widget — PermissionMatrix
//
// Grid of role-permission checkboxes. Rows are permissions,
// columns are roles, cells are toggleable checkboxes.
// ============================================================

import AppKit

public class ClefPermissionMatrixView: NSView {
    public var roles: [String] = [] { didSet { rebuild() } }
    public var permissions: [String] = [] { didSet { rebuild() } }
    public var matrix: [[Bool]] = [] { didSet { rebuild() } } // [permission][role]
    public var onToggle: ((Int, Int, Bool) -> Void)?

    private let scrollView = NSScrollView()
    private let gridView = NSGridView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        scrollView.documentView = gridView
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        addSubview(scrollView)
    }

    private func rebuild() {
        gridView.subviews.forEach { $0.removeFromSuperview() }
        guard !roles.isEmpty && !permissions.isEmpty else { return }

        // Header row
        var headerRow: [NSView] = [NSTextField(labelWithString: "")]
        for role in roles {
            let lbl = NSTextField(labelWithString: role)
            lbl.font = NSFont.systemFont(ofSize: 11, weight: .semibold)
            lbl.alignment = .center
            headerRow.append(lbl)
        }

        // Permission rows
        var allRows: [[NSView]] = [headerRow]
        for (pi, perm) in permissions.enumerated() {
            var row: [NSView] = []
            let lbl = NSTextField(labelWithString: perm)
            lbl.font = NSFont.systemFont(ofSize: 12)
            row.append(lbl)
            for ri in 0..<roles.count {
                let checked = pi < matrix.count && ri < matrix[pi].count ? matrix[pi][ri] : false
                let cb = NSButton(checkboxWithTitle: "", target: self, action: #selector(handleToggle(_:)))
                cb.state = checked ? .on : .off
                cb.tag = pi * 1000 + ri
                row.append(cb)
            }
            allRows.append(row)
        }

        // Build grid
        for row in allRows {
            gridView.addRow(with: row)
        }
    }

    @objc private func handleToggle(_ sender: NSButton) {
        let pi = sender.tag / 1000
        let ri = sender.tag % 1000
        onToggle?(pi, ri, sender.state == .on)
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}
