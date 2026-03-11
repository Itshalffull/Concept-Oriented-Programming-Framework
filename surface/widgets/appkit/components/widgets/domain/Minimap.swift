// ============================================================
// Clef Surface AppKit Widget — Minimap
//
// Scaled-down overview of a larger content area with a
// viewport indicator. Click to navigate.
// ============================================================

import AppKit

public class ClefMinimapView: NSView {
    public var contentSize: NSSize = NSSize(width: 2000, height: 2000) { didSet { needsDisplay = true } }
    public var viewportRect: NSRect = .zero { didSet { needsDisplay = true } }
    public var onViewportChange: ((NSRect) -> Void)?
    public var thumbnail: NSImage? { didSet { needsDisplay = true } }

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true; layer?.cornerRadius = 4; layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        thumbnail?.draw(in: bounds)
        let scaleX = bounds.width / contentSize.width
        let scaleY = bounds.height / contentSize.height
        let vpRect = NSRect(x: viewportRect.origin.x * scaleX, y: viewportRect.origin.y * scaleY,
                            width: viewportRect.width * scaleX, height: viewportRect.height * scaleY)
        NSColor.controlAccentColor.withAlphaComponent(0.3).setFill()
        NSBezierPath(rect: vpRect).fill()
        NSColor.controlAccentColor.setStroke()
        let border = NSBezierPath(rect: vpRect); border.lineWidth = 1; border.stroke()
    }

    public override func mouseDown(with event: NSEvent) { handleClick(event) }
    public override func mouseDragged(with event: NSEvent) { handleClick(event) }

    private func handleClick(_ event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let scaleX = contentSize.width / bounds.width
        let scaleY = contentSize.height / bounds.height
        let newOrigin = NSPoint(x: point.x * scaleX - viewportRect.width / 2, y: point.y * scaleY - viewportRect.height / 2)
        let newRect = NSRect(origin: newOrigin, size: viewportRect.size)
        onViewportChange?(newRect)
    }
}
