// ============================================================
// Clef Surface AppKit Widget — RadioCard
//
// Card-style radio option with icon, title, and description.
// Visually highlights the selected card in a radio group.
// ============================================================

import AppKit

public class ClefRadioCardView: NSView {
    public var title: String = "" { didSet { needsDisplay = true } }
    public var subtitle: String = "" { didSet { needsDisplay = true } }
    public var icon: String? = nil { didSet { needsDisplay = true } }
    public var selected: Bool = false { didSet { needsDisplay = true } }
    public var onSelect: (() -> Void)?

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
        layer?.cornerRadius = 8
        layer?.borderWidth = 2
        let click = NSClickGestureRecognizer(target: self, action: #selector(handleClick))
        addGestureRecognizer(click)
    }

    @objc private func handleClick() { onSelect?() }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        layer?.borderColor = selected ? NSColor.controlAccentColor.cgColor : NSColor.separatorColor.cgColor
        layer?.backgroundColor = selected ? NSColor.controlAccentColor.withAlphaComponent(0.05).cgColor : NSColor.controlBackgroundColor.cgColor

        var yOffset: CGFloat = bounds.height - 24
        if let iconName = icon, let img = NSImage(systemSymbolName: iconName, accessibilityDescription: nil) {
            img.draw(in: NSRect(x: 12, y: yOffset - 4, width: 20, height: 20))
            yOffset -= 28
        }

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
            .foregroundColor: NSColor.labelColor,
        ]
        (title as NSString).draw(at: NSPoint(x: 12, y: yOffset - 16), withAttributes: titleAttrs)

        let subAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        (subtitle as NSString).draw(at: NSPoint(x: 12, y: yOffset - 34), withAttributes: subAttrs)
    }
}
