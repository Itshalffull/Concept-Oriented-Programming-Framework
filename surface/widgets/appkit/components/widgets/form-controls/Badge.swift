// ============================================================
// Clef Surface AppKit Widget — Badge
//
// Small count or status indicator rendered as a colored pill.
// Supports numeric values, dot mode, and color variants.
// ============================================================

import AppKit

public class ClefBadgeView: NSView {
    public var value: String = "" { didSet { needsDisplay = true } }
    public var variant: String = "default" { didSet { needsDisplay = true } }
    public var dot: Bool = false { didSet { invalidateIntrinsicContentSize(); needsDisplay = true } }

    public override var intrinsicContentSize: NSSize {
        if dot { return NSSize(width: 8, height: 8) }
        let textWidth = (value as NSString).size(withAttributes: [.font: NSFont.systemFont(ofSize: 11, weight: .medium)]).width
        return NSSize(width: max(20, textWidth + 12), height: 20)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let bgColor: NSColor
        switch variant {
        case "success": bgColor = .systemGreen
        case "warning": bgColor = .systemOrange
        case "error": bgColor = .systemRed
        default: bgColor = .controlAccentColor
        }

        let path = NSBezierPath(roundedRect: bounds, xRadius: bounds.height / 2, yRadius: bounds.height / 2)
        bgColor.setFill()
        path.fill()

        if !dot {
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 11, weight: .medium),
                .foregroundColor: NSColor.white,
            ]
            let size = (value as NSString).size(withAttributes: attrs)
            let origin = NSPoint(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2)
            (value as NSString).draw(at: origin, withAttributes: attrs)
        }
    }
}
