// ============================================================
// Clef Surface AppKit Widget — NotificationItem
//
// Single notification entry with icon, title, message,
// timestamp, and read/unread state.
// ============================================================

import AppKit

public class ClefNotificationItemView: NSView {
    public var title: String = "" { didSet { needsDisplay = true } }
    public var message: String = "" { didSet { needsDisplay = true } }
    public var timestamp: String = "" { didSet { needsDisplay = true } }
    public var isRead: Bool = false { didSet { needsDisplay = true } }
    public var icon: String = "bell.fill" { didSet { needsDisplay = true } }
    public var onClick: (() -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        let click = NSClickGestureRecognizer(target: self, action: #selector(handleClick))
        addGestureRecognizer(click)
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
    }

    @objc private func handleClick() { onClick?() }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        layer?.backgroundColor = isRead ? NSColor.clear.cgColor : NSColor.controlAccentColor.withAlphaComponent(0.05).cgColor

        if let img = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
            img.draw(in: NSRect(x: 12, y: bounds.midY - 8, width: 16, height: 16))
        }

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13, weight: isRead ? .regular : .semibold),
            .foregroundColor: NSColor.labelColor,
        ]
        (title as NSString).draw(at: NSPoint(x: 36, y: bounds.height - 22), withAttributes: titleAttrs)

        let msgAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 11),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        (message as NSString).draw(at: NSPoint(x: 36, y: bounds.height - 40), withAttributes: msgAttrs)

        let timeAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10),
            .foregroundColor: NSColor.tertiaryLabelColor,
        ]
        let timeSize = (timestamp as NSString).size(withAttributes: timeAttrs)
        (timestamp as NSString).draw(at: NSPoint(x: bounds.width - timeSize.width - 12, y: bounds.height - 22), withAttributes: timeAttrs)

        if !isRead {
            NSColor.controlAccentColor.setFill()
            NSBezierPath(ovalIn: NSRect(x: bounds.width - 16, y: bounds.midY - 3, width: 6, height: 6)).fill()
        }
    }
}
