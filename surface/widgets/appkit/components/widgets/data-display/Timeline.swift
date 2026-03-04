// ============================================================
// Clef Surface AppKit Widget — Timeline
//
// Vertical timeline with dated event entries connected by a
// line. Each entry has a dot, title, and description.
// ============================================================

import AppKit

public class ClefTimelineView: NSView {
    public struct TimelineEntry {
        public let title: String
        public let description: String
        public let timestamp: String
        public let color: NSColor
        public init(title: String, description: String = "", timestamp: String = "", color: NSColor = .controlAccentColor) {
            self.title = title; self.description = description; self.timestamp = timestamp; self.color = color
        }
    }

    public var entries: [TimelineEntry] = [] { didSet { needsDisplay = true } }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let lineX: CGFloat = 20
        let entryHeight: CGFloat = 60

        // Connecting line
        NSColor.separatorColor.setStroke()
        let line = NSBezierPath()
        line.move(to: NSPoint(x: lineX, y: bounds.height - 16))
        line.line(to: NSPoint(x: lineX, y: bounds.height - CGFloat(entries.count) * entryHeight))
        line.lineWidth = 1
        line.stroke()

        for (i, entry) in entries.enumerated() {
            let y = bounds.height - CGFloat(i + 1) * entryHeight + 20

            // Dot
            entry.color.setFill()
            NSBezierPath(ovalIn: NSRect(x: lineX - 5, y: y + 12, width: 10, height: 10)).fill()

            // Title
            let titleAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
                .foregroundColor: NSColor.labelColor,
            ]
            (entry.title as NSString).draw(at: NSPoint(x: lineX + 16, y: y + 22), withAttributes: titleAttrs)

            // Description
            let descAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 11),
                .foregroundColor: NSColor.secondaryLabelColor,
            ]
            (entry.description as NSString).draw(at: NSPoint(x: lineX + 16, y: y + 4), withAttributes: descAttrs)

            // Timestamp
            let timeAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 10),
                .foregroundColor: NSColor.tertiaryLabelColor,
            ]
            let timeSize = (entry.timestamp as NSString).size(withAttributes: timeAttrs)
            (entry.timestamp as NSString).draw(at: NSPoint(x: bounds.width - timeSize.width - 8, y: y + 24), withAttributes: timeAttrs)
        }
    }
}
