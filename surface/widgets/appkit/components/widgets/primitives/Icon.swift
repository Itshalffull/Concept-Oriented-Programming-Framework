// ============================================================
// Clef Surface AppKit Widget — Icon
//
// Renders an SF Symbols icon or a fallback glyph at a given
// size and color. Wraps NSImageView for symbol rendering.
// ============================================================

import AppKit

public class ClefIconView: NSView {
    public var name: String = "star" { didSet { updateIcon() } }
    public var size: CGFloat = 16 { didSet { updateIcon() } }
    public var color: NSColor = .labelColor { didSet { updateIcon() } }

    private let imageView = NSImageView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        imageView.imageScaling = .scaleProportionallyUpOrDown
        addSubview(imageView)
        updateIcon()
    }

    private func updateIcon() {
        if let symbol = NSImage(systemSymbolName: name, accessibilityDescription: name) {
            let config = NSImage.SymbolConfiguration(pointSize: size, weight: .regular)
            imageView.image = symbol.withSymbolConfiguration(config)
            imageView.contentTintColor = color
        }
        imageView.frame = NSRect(x: 0, y: 0, width: size, height: size)
        invalidateIntrinsicContentSize()
    }

    public override var intrinsicContentSize: NSSize {
        return NSSize(width: size, height: size)
    }
}
