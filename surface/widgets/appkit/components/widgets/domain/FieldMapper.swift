// ============================================================
// Clef Surface AppKit Widget — FieldMapper
//
// Visual field mapping between source and target schemas.
// Draws connection lines between matched field pairs.
// ============================================================

import AppKit

public class ClefFieldMapperView: NSView {
    public struct Mapping {
        public let sourceField: String
        public let targetField: String
        public init(source: String, target: String) { self.sourceField = source; self.targetField = target }
    }

    public var sourceFields: [String] = [] { didSet { needsDisplay = true } }
    public var targetFields: [String] = [] { didSet { needsDisplay = true } }
    public var mappings: [Mapping] = [] { didSet { needsDisplay = true } }
    public var onMappingsChange: (([Mapping]) -> Void)?

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let rowH: CGFloat = 28
        let leftX: CGFloat = 0; let rightX = bounds.width - 140
        let midX = bounds.width / 2

        // Source fields
        for (i, field) in sourceFields.enumerated() {
            let y = bounds.height - CGFloat(i + 1) * rowH
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor.labelColor]
            (field as NSString).draw(at: NSPoint(x: leftX + 8, y: y + 6), withAttributes: attrs)
            NSColor.separatorColor.setFill()
            NSBezierPath(ovalIn: NSRect(x: 140, y: y + 10, width: 8, height: 8)).fill()
        }

        // Target fields
        for (i, field) in targetFields.enumerated() {
            let y = bounds.height - CGFloat(i + 1) * rowH
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12), .foregroundColor: NSColor.labelColor]
            (field as NSString).draw(at: NSPoint(x: rightX + 16, y: y + 6), withAttributes: attrs)
            NSColor.separatorColor.setFill()
            NSBezierPath(ovalIn: NSRect(x: rightX - 8, y: y + 10, width: 8, height: 8)).fill()
        }

        // Connection lines
        NSColor.controlAccentColor.setStroke()
        for mapping in mappings {
            guard let si = sourceFields.firstIndex(of: mapping.sourceField),
                  let ti = targetFields.firstIndex(of: mapping.targetField) else { continue }
            let sy = bounds.height - CGFloat(si + 1) * rowH + 14
            let ty = bounds.height - CGFloat(ti + 1) * rowH + 14
            let path = NSBezierPath()
            path.move(to: NSPoint(x: 148, y: sy))
            path.curve(to: NSPoint(x: rightX - 8, y: ty), controlPoint1: NSPoint(x: midX, y: sy), controlPoint2: NSPoint(x: midX, y: ty))
            path.lineWidth = 2; path.stroke()
        }
    }
}
