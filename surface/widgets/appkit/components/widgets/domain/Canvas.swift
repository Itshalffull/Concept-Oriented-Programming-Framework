// ============================================================
// Clef Surface AppKit Widget — Canvas
//
// Infinite pannable and zoomable canvas surface for placing
// nodes, shapes, and connectors. Supports zoom and pan.
// ============================================================

import AppKit

public class ClefCanvasView: NSView {
    public var zoomLevel: CGFloat = 1.0 { didSet { needsDisplay = true } }
    public var panOffset: NSPoint = .zero { didSet { needsDisplay = true } }
    public var onZoomChange: ((CGFloat) -> Void)?
    public var onPanChange: ((NSPoint) -> Void)?

    private var isPanning = false
    private var lastPanPoint: NSPoint = .zero

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.textBackgroundColor.cgColor
    }

    public override func magnify(with event: NSEvent) {
        zoomLevel = max(0.1, min(5.0, zoomLevel + event.magnification))
        onZoomChange?(zoomLevel)
    }

    public override func scrollWheel(with event: NSEvent) {
        panOffset.x += event.scrollingDeltaX
        panOffset.y += event.scrollingDeltaY
        onPanChange?(panOffset)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let ctx = NSGraphicsContext.current?.cgContext
        ctx?.translateBy(x: panOffset.x, y: panOffset.y)
        ctx?.scaleBy(x: zoomLevel, y: zoomLevel)

        // Grid
        NSColor.separatorColor.withAlphaComponent(0.3).setStroke()
        let gridSize: CGFloat = 40
        let visibleWidth = bounds.width / zoomLevel
        let visibleHeight = bounds.height / zoomLevel
        for x in stride(from: CGFloat(0), through: visibleWidth, by: gridSize) {
            let path = NSBezierPath()
            path.move(to: NSPoint(x: x, y: 0)); path.line(to: NSPoint(x: x, y: visibleHeight))
            path.lineWidth = 0.5; path.stroke()
        }
        for y in stride(from: CGFloat(0), through: visibleHeight, by: gridSize) {
            let path = NSBezierPath()
            path.move(to: NSPoint(x: 0, y: y)); path.line(to: NSPoint(x: visibleWidth, y: y))
            path.lineWidth = 0.5; path.stroke()
        }
    }

    public func addCanvasChild(_ view: NSView, at point: NSPoint) {
        addSubview(view)
        view.frame.origin = point
    }
}
