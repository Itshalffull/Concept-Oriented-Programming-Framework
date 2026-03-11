// ============================================================
// Clef Surface AppKit Widget — StepIndicator
//
// Multi-step progress indicator showing completed, current,
// and upcoming steps with labels and connecting lines.
// ============================================================

import AppKit

public class ClefStepIndicatorView: NSView {
    public struct Step {
        public let label: String
        public let status: String // "completed", "current", "upcoming"
        public init(label: String, status: String) { self.label = label; self.status = status }
    }

    public var steps: [Step] = [] { didSet { needsDisplay = true } }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard !steps.isEmpty else { return }
        let spacing = bounds.width / CGFloat(steps.count)
        let y = bounds.midY

        for (i, step) in steps.enumerated() {
            let x = spacing * CGFloat(i) + spacing / 2

            // Connecting line
            if i > 0 {
                let prevX = spacing * CGFloat(i - 1) + spacing / 2
                let lineColor: NSColor = step.status == "upcoming" ? .separatorColor : .controlAccentColor
                lineColor.setStroke()
                let line = NSBezierPath(); line.move(to: NSPoint(x: prevX + 12, y: y)); line.line(to: NSPoint(x: x - 12, y: y))
                line.lineWidth = 2; line.stroke()
            }

            // Circle
            let circleRect = NSRect(x: x - 12, y: y - 12, width: 24, height: 24)
            switch step.status {
            case "completed":
                NSColor.controlAccentColor.setFill(); NSBezierPath(ovalIn: circleRect).fill()
                let check = NSImage(systemSymbolName: "checkmark", accessibilityDescription: nil)
                check?.draw(in: circleRect.insetBy(dx: 5, dy: 5))
            case "current":
                NSColor.controlAccentColor.setStroke()
                let border = NSBezierPath(ovalIn: circleRect); border.lineWidth = 2; border.stroke()
                NSColor.controlAccentColor.setFill()
                NSBezierPath(ovalIn: circleRect.insetBy(dx: 6, dy: 6)).fill()
            default:
                NSColor.separatorColor.setStroke()
                let border = NSBezierPath(ovalIn: circleRect); border.lineWidth = 1.5; border.stroke()
            }

            // Label
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]
            let sz = (step.label as NSString).size(withAttributes: attrs)
            (step.label as NSString).draw(at: NSPoint(x: x - sz.width / 2, y: y - 28), withAttributes: attrs)
        }
    }
}
