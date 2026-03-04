// ============================================================
// Clef Surface AppKit Widget — GraphView
//
// Force-directed or hierarchical graph visualization with
// nodes and edges. Renders using Core Graphics.
// ============================================================

import AppKit

public class ClefGraphViewWidget: NSView {
    public struct GraphNode {
        public let id: String
        public let label: String
        public var position: NSPoint
        public init(id: String, label: String, position: NSPoint = .zero) {
            self.id = id; self.label = label; self.position = position
        }
    }

    public struct GraphEdge {
        public let sourceId: String
        public let targetId: String
        public init(source: String, target: String) { self.sourceId = source; self.targetId = target }
    }

    public var nodes: [GraphNode] = [] { didSet { needsDisplay = true } }
    public var edges: [GraphEdge] = [] { didSet { needsDisplay = true } }
    public var onNodeSelect: ((String) -> Void)?

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        // Edges
        NSColor.separatorColor.setStroke()
        for edge in edges {
            guard let src = nodes.first(where: { $0.id == edge.sourceId }),
                  let tgt = nodes.first(where: { $0.id == edge.targetId }) else { continue }
            let path = NSBezierPath()
            path.move(to: src.position); path.line(to: tgt.position)
            path.lineWidth = 1; path.stroke()
        }

        // Nodes
        for node in nodes {
            let nodeSize: CGFloat = 32
            let rect = NSRect(x: node.position.x - nodeSize / 2, y: node.position.y - nodeSize / 2, width: nodeSize, height: nodeSize)
            NSColor.controlAccentColor.withAlphaComponent(0.2).setFill()
            NSBezierPath(ovalIn: rect).fill()
            NSColor.controlAccentColor.setStroke()
            NSBezierPath(ovalIn: rect).stroke()
            let attrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 10), .foregroundColor: NSColor.labelColor]
            let size = (node.label as NSString).size(withAttributes: attrs)
            (node.label as NSString).draw(at: NSPoint(x: node.position.x - size.width / 2, y: node.position.y - size.height / 2), withAttributes: attrs)
        }
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        for node in nodes {
            let dist = hypot(point.x - node.position.x, point.y - node.position.y)
            if dist < 20 { onNodeSelect?(node.id); return }
        }
    }
}
