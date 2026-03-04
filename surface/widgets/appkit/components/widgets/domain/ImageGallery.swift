// ============================================================
// Clef Surface AppKit Widget — ImageGallery
//
// Grid gallery of images with selection, lightbox preview,
// and thumbnail navigation.
// ============================================================

import AppKit

public class ClefImageGalleryView: NSView {
    public var images: [NSImage] = [] { didSet { needsLayout = true } }
    public var selectedIndex: Int? { didSet { needsDisplay = true } }
    public var thumbnailSize: CGFloat = 80
    public var onSelect: ((Int) -> Void)?

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); wantsLayer = true }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    public override func layout() {
        super.layout()
        subviews.forEach { $0.removeFromSuperview() }
        let gap: CGFloat = 8
        let cols = max(1, Int(bounds.width / (thumbnailSize + gap)))
        for (i, img) in images.enumerated() {
            let row = i / cols; let col = i % cols
            let x = CGFloat(col) * (thumbnailSize + gap)
            let y = bounds.height - CGFloat(row + 1) * (thumbnailSize + gap)
            let iv = NSImageView(image: img)
            iv.imageScaling = .scaleProportionallyUpOrDown
            iv.frame = NSRect(x: x, y: y, width: thumbnailSize, height: thumbnailSize)
            iv.wantsLayer = true; iv.layer?.cornerRadius = 4
            if i == selectedIndex { iv.layer?.borderWidth = 2; iv.layer?.borderColor = NSColor.controlAccentColor.cgColor }
            addSubview(iv)
        }
    }

    public override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        let gap: CGFloat = 8
        let cols = max(1, Int(bounds.width / (thumbnailSize + gap)))
        let col = Int(point.x / (thumbnailSize + gap))
        let row = Int((bounds.height - point.y) / (thumbnailSize + gap))
        let index = row * cols + col
        guard index < images.count else { return }
        selectedIndex = index; onSelect?(index)
    }
}
