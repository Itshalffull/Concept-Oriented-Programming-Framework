// ============================================================
// Clef Surface AppKit Widget — DragHandle
//
// Grippy drag handle indicator for reorderable items.
// Renders dots/lines pattern to indicate draggability.
// ============================================================

import AppKit

public class ClefDragHandleView: NSView {
    public var orientation: String = "vertical" { didSet { needsDisplay = true } }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        NSColor.tertiaryLabelColor.setFill()
        let dotSize: CGFloat = 3
        let gap: CGFloat = 3

        if orientation == "vertical" {
            for row in 0..<3 {
                for col in 0..<2 {
                    let x = bounds.midX - 5 + CGFloat(col) * (dotSize + gap)
                    let y = bounds.midY - 8 + CGFloat(row) * (dotSize + gap)
                    NSBezierPath(ovalIn: NSRect(x: x, y: y, width: dotSize, height: dotSize)).fill()
                }
            }
        } else {
            for row in 0..<2 {
                for col in 0..<3 {
                    let x = bounds.midX - 8 + CGFloat(col) * (dotSize + gap)
                    let y = bounds.midY - 5 + CGFloat(row) * (dotSize + gap)
                    NSBezierPath(ovalIn: NSRect(x: x, y: y, width: dotSize, height: dotSize)).fill()
                }
            }
        }
    }

    public override var intrinsicContentSize: NSSize { NSSize(width: 16, height: 24) }

    public override func resetCursorRects() {
        addCursorRect(bounds, cursor: .openHand)
    }
}
