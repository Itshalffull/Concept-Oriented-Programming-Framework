// ============================================================
// Clef Surface AppKit Widget — ColorLabelPicker
//
// Palette of preset labeled colors for categorization.
// Shows a grid of color swatches with selection state.
// ============================================================

import AppKit

public class ClefColorLabelPickerView: NSView {
    public struct ColorLabel {
        public let name: String
        public let color: NSColor
        public init(name: String, color: NSColor) { self.name = name; self.color = color }
    }

    public var options: [ColorLabel] = [] { didSet { needsDisplay = true } }
    public var selectedName: String? { didSet { needsDisplay = true } }
    public var onSelect: ((String) -> Void)?

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let swatchSize: CGFloat = 28
        let gap: CGFloat = 8
        let cols = max(1, Int(bounds.width / (swatchSize + gap)))

        for (i, opt) in options.enumerated() {
            let row = i / cols; let col = i % cols
            let x = CGFloat(col) * (swatchSize + gap)
            let y = bounds.height - CGFloat(row + 1) * (swatchSize + gap)
            let rect = NSRect(x: x, y: y, width: swatchSize, height: swatchSize)
            opt.color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: 6, yRadius: 6).fill()
            if opt.name == selectedName {
                NSColor.white.setStroke()
                let check = NSBezierPath(roundedRect: rect.insetBy(dx: 2, dy: 2), xRadius: 5, yRadius: 5)
                check.lineWidth = 2; check.stroke()
            }
        }
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let swatchSize: CGFloat = 28; let gap: CGFloat = 8
        let cols = max(1, Int(bounds.width / (swatchSize + gap)))
        let col = Int(point.x / (swatchSize + gap))
        let row = Int((bounds.height - point.y) / (swatchSize + gap))
        let index = row * cols + col
        guard index < options.count else { return }
        selectedName = options[index].name
        onSelect?(options[index].name)
    }
}
