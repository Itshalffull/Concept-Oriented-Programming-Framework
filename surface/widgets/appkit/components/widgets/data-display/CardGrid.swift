// ============================================================
// Clef Surface AppKit Widget — CardGrid
//
// Responsive grid layout for Card widgets. Arranges cards
// in columns with configurable min width and gap.
// ============================================================

import AppKit

public class ClefCardGridView: NSView {
    public var cards: [NSView] = [] { didSet { rebuild() } }
    public var minColumnWidth: CGFloat = 240
    public var gap: CGFloat = 16

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    private func rebuild() {
        subviews.forEach { $0.removeFromSuperview() }
        cards.forEach { addSubview($0) }
        needsLayout = true
    }

    public override func layout() {
        super.layout()
        guard !cards.isEmpty else { return }

        let cols = max(1, Int(bounds.width / (minColumnWidth + gap)))
        let cardWidth = (bounds.width - CGFloat(cols - 1) * gap) / CGFloat(cols)
        let cardHeight = cardWidth * 0.7

        for (i, card) in cards.enumerated() {
            let row = i / cols
            let col = i % cols
            let x = CGFloat(col) * (cardWidth + gap)
            let y = bounds.height - CGFloat(row + 1) * (cardHeight + gap)
            card.frame = NSRect(x: x, y: y, width: cardWidth, height: cardHeight)
        }
    }
}
