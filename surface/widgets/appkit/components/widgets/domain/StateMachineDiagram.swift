// ============================================================
// Clef Surface AppKit Widget — StateMachineDiagram
//
// Visual state machine with state nodes and labeled
// transition arrows. Read-only diagram display.
// ============================================================

import AppKit

public class ClefStateMachineDiagramView: NSView {
    public struct State {
        public let id: String
        public let label: String
        public var position: NSPoint
        public var isInitial: Bool
        public var isFinal: Bool
        public init(id: String, label: String, position: NSPoint, isInitial: Bool = false, isFinal: Bool = false) {
            self.id = id; self.label = label; self.position = position; self.isInitial = isInitial; self.isFinal = isFinal
        }
    }

    public struct Transition {
        public let fromId: String
        public let toId: String
        public let label: String
        public init(from: String, to: String, label: String = "") { self.fromId = from; self.toId = to; self.label = label }
    }

    public var states: [State] = [] { didSet { needsDisplay = true } }
    public var transitions: [Transition] = [] { didSet { needsDisplay = true } }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        // Transitions
        for trans in transitions {
            guard let src = states.first(where: { $0.id == trans.fromId }),
                  let tgt = states.first(where: { $0.id == trans.toId }) else { continue }
            NSColor.secondaryLabelColor.setStroke()
            let path = NSBezierPath(); path.move(to: src.position); path.line(to: tgt.position)
            path.lineWidth = 1.5; path.stroke()
            if !trans.label.isEmpty {
                let mid = NSPoint(x: (src.position.x + tgt.position.x) / 2, y: (src.position.y + tgt.position.y) / 2 + 8)
                let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.secondaryLabelColor]
                (trans.label as NSString).draw(at: mid, withAttributes: attrs)
            }
        }

        // States
        for state in states {
            let r: CGFloat = 28
            let rect = NSRect(x: state.position.x - r, y: state.position.y - r, width: r * 2, height: r * 2)
            NSColor.controlBackgroundColor.setFill(); NSBezierPath(roundedRect: rect, xRadius: r, yRadius: r).fill()
            NSColor.separatorColor.setStroke()
            let border = NSBezierPath(roundedRect: rect, xRadius: r, yRadius: r)
            border.lineWidth = state.isInitial ? 2 : 1; border.stroke()
            if state.isFinal {
                let inner = rect.insetBy(dx: 4, dy: 4)
                NSBezierPath(roundedRect: inner, xRadius: r - 4, yRadius: r - 4).stroke()
            }
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 11, weight: .medium), .foregroundColor: NSColor.labelColor]
            let sz = (state.label as NSString).size(withAttributes: attrs)
            (state.label as NSString).draw(at: NSPoint(x: state.position.x - sz.width / 2, y: state.position.y - sz.height / 2), withAttributes: attrs)
        }
    }
}
