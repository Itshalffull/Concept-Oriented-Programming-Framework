// ============================================================
// Clef Surface AppKit Widget — Gauge
//
// Circular or semicircular gauge displaying a value within
// a range. Uses Core Graphics arc drawing.
// ============================================================

import AppKit

public class ClefGaugeView: NSView {
    public var value: Double = 0 { didSet { needsDisplay = true } }
    public var minValue: Double = 0
    public var maxValue: Double = 100
    public var label: String = "" { didSet { needsDisplay = true } }
    public var color: NSColor = .controlAccentColor

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let center = NSPoint(x: bounds.midX, y: bounds.midY)
        let radius = min(bounds.width, bounds.height) / 2 - 8
        let startAngle: CGFloat = 225
        let endAngle: CGFloat = -45
        let totalArc = startAngle - endAngle
        let normalized = CGFloat((value - minValue) / (maxValue - minValue))
        let valueAngle = startAngle - totalArc * normalized

        // Track
        let track = NSBezierPath()
        track.appendArc(withCenter: center, radius: radius, startAngle: startAngle, endAngle: endAngle, clockwise: true)
        NSColor.separatorColor.setStroke()
        track.lineWidth = 8
        track.lineCapStyle = .round
        track.stroke()

        // Value
        let valuePath = NSBezierPath()
        valuePath.appendArc(withCenter: center, radius: radius, startAngle: startAngle, endAngle: valueAngle, clockwise: true)
        color.setStroke()
        valuePath.lineWidth = 8
        valuePath.lineCapStyle = .round
        valuePath.stroke()

        // Label
        let text = label.isEmpty ? "\(Int(value))" : label
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedDigitSystemFont(ofSize: 20, weight: .bold),
            .foregroundColor: NSColor.labelColor,
        ]
        let size = (text as NSString).size(withAttributes: attrs)
        (text as NSString).draw(at: NSPoint(x: center.x - size.width / 2, y: center.y - size.height / 2), withAttributes: attrs)
    }
}
