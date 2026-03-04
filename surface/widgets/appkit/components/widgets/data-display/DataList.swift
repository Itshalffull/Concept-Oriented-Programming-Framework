// ============================================================
// Clef Surface AppKit Widget — DataList
//
// Vertical list of key-value pairs or labeled data rows.
// Supports alternating row backgrounds for readability.
// ============================================================

import AppKit

public class ClefDataListView: NSView {
    public struct DataRow {
        public let label: String
        public let value: String
        public init(label: String, value: String) { self.label = label; self.value = value }
    }

    public var rows: [DataRow] = [] { didSet { needsDisplay = true } }
    public var alternateColors: Bool = true

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let rowHeight: CGFloat = 28
        for (i, row) in rows.enumerated() {
            let y = bounds.height - CGFloat(i + 1) * rowHeight
            let rect = NSRect(x: 0, y: y, width: bounds.width, height: rowHeight)

            if alternateColors && i % 2 == 1 {
                NSColor.controlBackgroundColor.setFill()
                NSBezierPath(rect: rect).fill()
            }

            let labelAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 12, weight: .medium),
                .foregroundColor: NSColor.secondaryLabelColor,
            ]
            (row.label as NSString).draw(at: NSPoint(x: 12, y: y + 6), withAttributes: labelAttrs)

            let valueAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 12),
                .foregroundColor: NSColor.labelColor,
            ]
            (row.value as NSString).draw(at: NSPoint(x: bounds.width / 2, y: y + 6), withAttributes: valueAttrs)
        }
    }
}
