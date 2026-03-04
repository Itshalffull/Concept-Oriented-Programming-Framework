// ============================================================
// Clef Surface AppKit Widget — CanvasConnector
//
// Line/curve connector between two canvas nodes. Draws a
// bezier path from source to target port with arrowhead.
// ============================================================

import AppKit

public class ClefCanvasConnectorView: NSView {
    public var sourcePoint: NSPoint = .zero { didSet { needsDisplay = true } }
    public var targetPoint: NSPoint = .zero { didSet { needsDisplay = true } }
    public var color: NSColor = .controlAccentColor { didSet { needsDisplay = true } }
    public var lineWidth: CGFloat = 2 { didSet { needsDisplay = true } }
    public var selected: Bool = false { didSet { needsDisplay = true } }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let path = NSBezierPath()
        path.move(to: sourcePoint)
        let midX = (sourcePoint.x + targetPoint.x) / 2
        path.curve(to: targetPoint,
                    controlPoint1: NSPoint(x: midX, y: sourcePoint.y),
                    controlPoint2: NSPoint(x: midX, y: targetPoint.y))
        let drawColor = selected ? color : color.withAlphaComponent(0.6)
        drawColor.setStroke()
        path.lineWidth = selected ? lineWidth + 1 : lineWidth
        path.stroke()

        // Arrowhead
        let angle = atan2(targetPoint.y - sourcePoint.y, targetPoint.x - sourcePoint.x)
        let arrowLen: CGFloat = 10
        let arrow = NSBezierPath()
        arrow.move(to: targetPoint)
        arrow.line(to: NSPoint(x: targetPoint.x - arrowLen * cos(angle - .pi / 6), y: targetPoint.y - arrowLen * sin(angle - .pi / 6)))
        arrow.move(to: targetPoint)
        arrow.line(to: NSPoint(x: targetPoint.x - arrowLen * cos(angle + .pi / 6), y: targetPoint.y - arrowLen * sin(angle + .pi / 6)))
        drawColor.setStroke()
        arrow.lineWidth = lineWidth
        arrow.stroke()
    }

    public override func hitTest(_ point: NSPoint) -> NSView? {
        let localPoint = convert(point, from: superview)
        let midX = (sourcePoint.x + targetPoint.x) / 2
        let path = NSBezierPath()
        path.move(to: sourcePoint)
        path.curve(to: targetPoint, controlPoint1: NSPoint(x: midX, y: sourcePoint.y), controlPoint2: NSPoint(x: midX, y: targetPoint.y))
        let strokedPath = path.copy() as! NSBezierPath
        strokedPath.lineWidth = 10
        if strokedPath.contains(localPoint) { return self }
        return nil
    }
}
