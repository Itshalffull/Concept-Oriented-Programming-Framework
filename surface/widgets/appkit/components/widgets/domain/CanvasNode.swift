// ============================================================
// Clef Surface AppKit Widget — CanvasNode
//
// Draggable node on a canvas surface with input/output ports,
// title, and configurable content area.
// ============================================================

import AppKit

public class ClefCanvasNodeView: NSView {
    public var nodeTitle: String = "" { didSet { needsDisplay = true } }
    public var inputPorts: [String] = []
    public var outputPorts: [String] = []
    public var selected: Bool = false { didSet { needsDisplay = true } }
    public var onDrag: ((NSPoint) -> Void)?
    public var onSelect: (() -> Void)?

    private var dragOffset: NSPoint = .zero

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 2
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = 0.1
        layer?.shadowRadius = 4
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        layer?.borderColor = selected ? NSColor.controlAccentColor.cgColor : NSColor.separatorColor.cgColor

        // Title
        let titleAttrs: [NSAttributedString.Key: Any] = [.font: NSFont.systemFont(ofSize: 12, weight: .semibold), .foregroundColor: NSColor.labelColor]
        (nodeTitle as NSString).draw(at: NSPoint(x: 12, y: bounds.height - 22), withAttributes: titleAttrs)

        // Ports
        let portSize: CGFloat = 8
        for (i, _) in inputPorts.enumerated() {
            let y = bounds.height - 40 - CGFloat(i) * 16
            NSColor.systemBlue.setFill()
            NSBezierPath(ovalIn: NSRect(x: -4, y: y, width: portSize, height: portSize)).fill()
        }
        for (i, _) in outputPorts.enumerated() {
            let y = bounds.height - 40 - CGFloat(i) * 16
            NSColor.systemGreen.setFill()
            NSBezierPath(ovalIn: NSRect(x: bounds.width - 4, y: y, width: portSize, height: portSize)).fill()
        }
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        dragOffset = NSPoint(x: point.x - frame.origin.x, y: point.y - frame.origin.y)
        onSelect?()
    }

    public override func mouseDragged(with event: NSEvent) {
        let point = superview?.convert(event.locationInWindow, from: nil) ?? .zero
        frame.origin = NSPoint(x: point.x - dragOffset.x, y: point.y - dragOffset.y)
        onDrag?(frame.origin)
    }
}
