// ============================================================
// Clef Surface AppKit Widget — Chip
//
// Compact element for tags, tokens, or categories. Supports
// closable/removable state and selected highlight.
// ============================================================

import AppKit

public class ClefChipView: NSView {
    public var label: String = "" { didSet { needsDisplay = true } }
    public var selected: Bool = false { didSet { needsDisplay = true } }
    public var closable: Bool = false { didSet { needsDisplay = true } }
    public var onClose: (() -> Void)?
    public var onSelect: (() -> Void)?

    private let textField = NSTextField(labelWithString: "")
    private let closeButton = NSButton()

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
        layer?.cornerRadius = 12
        layer?.borderWidth = 1

        textField.font = NSFont.systemFont(ofSize: 12)
        textField.isEditable = false
        textField.isBezeled = false
        textField.drawsBackground = false
        addSubview(textField)

        closeButton.bezelStyle = .inline
        closeButton.image = NSImage(systemSymbolName: "xmark.circle.fill", accessibilityDescription: "Remove")
        closeButton.isBordered = false
        closeButton.target = self
        closeButton.action = #selector(handleClose)
        addSubview(closeButton)

        let click = NSClickGestureRecognizer(target: self, action: #selector(handleSelect))
        addGestureRecognizer(click)
    }

    @objc private func handleClose() { onClose?() }
    @objc private func handleSelect() { onSelect?() }

    public override func layout() {
        super.layout()
        textField.stringValue = label
        textField.sizeToFit()
        let padding: CGFloat = 8
        textField.frame.origin = NSPoint(x: padding, y: (bounds.height - textField.frame.height) / 2)
        closeButton.isHidden = !closable
        if closable {
            closeButton.frame = NSRect(x: textField.frame.maxX + 4, y: (bounds.height - 16) / 2, width: 16, height: 16)
        }
        layer?.backgroundColor = selected ? NSColor.controlAccentColor.withAlphaComponent(0.15).cgColor : NSColor.controlBackgroundColor.cgColor
        layer?.borderColor = selected ? NSColor.controlAccentColor.cgColor : NSColor.separatorColor.cgColor
    }

    public override var intrinsicContentSize: NSSize {
        let textWidth = (label as NSString).size(withAttributes: [.font: NSFont.systemFont(ofSize: 12)]).width
        let closeWidth: CGFloat = closable ? 24 : 0
        return NSSize(width: textWidth + 20 + closeWidth, height: 28)
    }
}
