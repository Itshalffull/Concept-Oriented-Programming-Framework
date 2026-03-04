// ============================================================
// Clef Surface AppKit Widget — Rating
//
// Star-based rating input. Displays filled/empty stars and
// supports half-star precision on click.
// ============================================================

import AppKit

public class ClefRatingView: NSView {
    public var rating: Double = 0 { didSet { needsDisplay = true } }
    public var maxRating: Int = 5
    public var allowHalf: Bool = true
    public var readOnly: Bool = false
    public var onRatingChange: ((Double) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let starSize: CGFloat = 20
        let gap: CGFloat = 4

        for i in 0..<maxRating {
            let x = CGFloat(i) * (starSize + gap)
            let y = (bounds.height - starSize) / 2
            let rect = NSRect(x: x, y: y, width: starSize, height: starSize)

            let fillLevel: Double
            if Double(i + 1) <= rating { fillLevel = 1.0 }
            else if Double(i) < rating { fillLevel = rating - Double(i) }
            else { fillLevel = 0 }

            let iconName = fillLevel >= 1.0 ? "star.fill" : fillLevel >= 0.5 ? "star.leadinghalf.filled" : "star"
            if let img = NSImage(systemSymbolName: iconName, accessibilityDescription: nil) {
                let config = NSImage.SymbolConfiguration(pointSize: starSize, weight: .regular)
                let colored = img.withSymbolConfiguration(config)
                NSColor.systemYellow.set()
                colored?.draw(in: rect)
            }
        }
    }

    public override func mouseDown(with event: NSEvent) {
        guard !readOnly else { return }
        let point = convert(event.locationInWindow, from: nil)
        let starSize: CGFloat = 20
        let gap: CGFloat = 4
        let index = Int(point.x / (starSize + gap))
        let fraction = (point.x - CGFloat(index) * (starSize + gap)) / starSize

        if allowHalf && fraction < 0.5 {
            rating = Double(index) + 0.5
        } else {
            rating = Double(index + 1)
        }
        rating = min(Double(maxRating), max(0, rating))
        onRatingChange?(rating)
    }

    public override var intrinsicContentSize: NSSize {
        NSSize(width: CGFloat(maxRating) * 24, height: 24)
    }
}
