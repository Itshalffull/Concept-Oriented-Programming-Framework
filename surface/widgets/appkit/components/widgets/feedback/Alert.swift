// ============================================================
// Clef Surface AppKit Widget — Alert
//
// Inline alert banner with icon, message, and optional action.
// Supports info, success, warning, and error variants.
// ============================================================

import AppKit

public class ClefAlertView: NSView {
    public var message: String = "" { didSet { needsDisplay = true } }
    public var title: String = "" { didSet { needsDisplay = true } }
    public var variant: String = "info" { didSet { needsDisplay = true } }
    public var closable: Bool = true { didSet { closeButton.isHidden = !closable } }
    public var onClose: (() -> Void)?

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
        layer?.cornerRadius = 8

        closeButton.bezelStyle = .inline
        closeButton.isBordered = false
        closeButton.image = NSImage(systemSymbolName: "xmark", accessibilityDescription: "Close")
        closeButton.target = self
        closeButton.action = #selector(handleClose)
        addSubview(closeButton)
    }

    @objc private func handleClose() { onClose?() }

    private var variantColor: NSColor {
        switch variant {
        case "success": return .systemGreen
        case "warning": return .systemOrange
        case "error": return .systemRed
        default: return .systemBlue
        }
    }

    private var variantIcon: String {
        switch variant {
        case "success": return "checkmark.circle.fill"
        case "warning": return "exclamationmark.triangle.fill"
        case "error": return "xmark.octagon.fill"
        default: return "info.circle.fill"
        }
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        layer?.backgroundColor = variantColor.withAlphaComponent(0.08).cgColor
        layer?.borderColor = variantColor.withAlphaComponent(0.3).cgColor
        layer?.borderWidth = 1

        if let icon = NSImage(systemSymbolName: variantIcon, accessibilityDescription: nil) {
            icon.draw(in: NSRect(x: 12, y: bounds.height - 28, width: 16, height: 16))
        }

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13, weight: .semibold),
            .foregroundColor: NSColor.labelColor,
        ]
        (title as NSString).draw(at: NSPoint(x: 36, y: bounds.height - 28), withAttributes: titleAttrs)

        let msgAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 12),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        (message as NSString).draw(at: NSPoint(x: 36, y: bounds.height - 48), withAttributes: msgAttrs)
    }

    public override func layout() {
        super.layout()
        closeButton.frame = NSRect(x: bounds.width - 28, y: bounds.height - 28, width: 16, height: 16)
    }
}
