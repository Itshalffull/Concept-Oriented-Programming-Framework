// ============================================================
// Clef Surface AppKit Widget — RangeSlider
//
// Dual-thumb slider for selecting a value range between
// min and max bounds. Custom drawn with Core Graphics.
// ============================================================

import AppKit

public class ClefRangeSliderView: NSView {
    public var minValue: Double = 0 { didSet { needsDisplay = true } }
    public var maxValue: Double = 100 { didSet { needsDisplay = true } }
    public var lowerValue: Double = 20 { didSet { needsDisplay = true } }
    public var upperValue: Double = 80 { didSet { needsDisplay = true } }
    public var onRangeChange: ((Double, Double) -> Void)?

    private var draggingLower = false
    private var draggingUpper = false
    private let thumbSize: CGFloat = 16
    private let trackHeight: CGFloat = 4

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let trackY = (bounds.height - trackHeight) / 2
        let range = maxValue - minValue
        guard range > 0 else { return }

        // Track background
        let trackRect = NSRect(x: thumbSize / 2, y: trackY, width: bounds.width - thumbSize, height: trackHeight)
        NSColor.separatorColor.setFill()
        NSBezierPath(roundedRect: trackRect, xRadius: 2, yRadius: 2).fill()

        // Selected range
        let lowerX = CGFloat((lowerValue - minValue) / range) * (bounds.width - thumbSize) + thumbSize / 2
        let upperX = CGFloat((upperValue - minValue) / range) * (bounds.width - thumbSize) + thumbSize / 2
        let selectedRect = NSRect(x: lowerX, y: trackY, width: upperX - lowerX, height: trackHeight)
        NSColor.controlAccentColor.setFill()
        NSBezierPath(roundedRect: selectedRect, xRadius: 2, yRadius: 2).fill()

        // Thumbs
        for x in [lowerX, upperX] {
            let thumbRect = NSRect(x: x - thumbSize / 2, y: (bounds.height - thumbSize) / 2, width: thumbSize, height: thumbSize)
            NSColor.white.setFill()
            NSBezierPath(ovalIn: thumbRect).fill()
            NSColor.separatorColor.setStroke()
            NSBezierPath(ovalIn: thumbRect.insetBy(dx: 0.5, dy: 0.5)).stroke()
        }
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let range = maxValue - minValue
        let lowerX = CGFloat((lowerValue - minValue) / range) * (bounds.width - thumbSize) + thumbSize / 2
        let upperX = CGFloat((upperValue - minValue) / range) * (bounds.width - thumbSize) + thumbSize / 2

        if abs(point.x - lowerX) < abs(point.x - upperX) { draggingLower = true } else { draggingUpper = true }
    }

    public override func mouseDragged(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let range = maxValue - minValue
        let ratio = Double((point.x - thumbSize / 2) / (bounds.width - thumbSize))
        let val = minValue + ratio * range

        if draggingLower { lowerValue = max(minValue, min(val, upperValue)) }
        if draggingUpper { upperValue = max(lowerValue, min(val, maxValue)) }
        onRangeChange?(lowerValue, upperValue)
    }

    public override func mouseUp(with event: NSEvent) {
        draggingLower = false
        draggingUpper = false
    }
}
