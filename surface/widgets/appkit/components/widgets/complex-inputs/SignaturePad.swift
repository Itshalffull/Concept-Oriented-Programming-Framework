// ============================================================
// Clef Surface AppKit Widget — SignaturePad
//
// Freehand drawing canvas for capturing signatures.
// Supports clear, undo, and image export.
// ============================================================

import AppKit

public class ClefSignaturePadView: NSView {
    public var lineColor: NSColor = .labelColor
    public var lineWidth: CGFloat = 2.0
    public var onSignatureChange: ((NSImage?) -> Void)?

    private var paths: [NSBezierPath] = []
    private var currentPath: NSBezierPath?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.white.cgColor
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        currentPath = NSBezierPath()
        currentPath?.lineWidth = lineWidth
        currentPath?.lineCapStyle = .round
        currentPath?.lineJoinStyle = .round
        currentPath?.move(to: point)
    }

    public override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        currentPath?.line(to: point)
        needsDisplay = true
    }

    public override func mouseUp(with event: NSEvent) {
        if let path = currentPath { paths.append(path) }
        currentPath = nil
        onSignatureChange?(exportImage())
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        lineColor.setStroke()
        for path in paths { path.stroke() }
        currentPath?.stroke()

        if paths.isEmpty && currentPath == nil {
            let text = "Sign here"
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 16),
                .foregroundColor: NSColor.placeholderTextColor,
            ]
            let size = (text as NSString).size(withAttributes: attrs)
            (text as NSString).draw(at: NSPoint(x: (bounds.width - size.width) / 2, y: (bounds.height - size.height) / 2), withAttributes: attrs)
        }
    }

    public func clear() {
        paths.removeAll()
        currentPath = nil
        needsDisplay = true
        onSignatureChange?(nil)
    }

    public func undo() {
        _ = paths.popLast()
        needsDisplay = true
        onSignatureChange?(exportImage())
    }

    public func exportImage() -> NSImage? {
        guard !paths.isEmpty else { return nil }
        let image = NSImage(size: bounds.size)
        image.lockFocus()
        lineColor.setStroke()
        for path in paths { path.stroke() }
        image.unlockFocus()
        return image
    }
}
