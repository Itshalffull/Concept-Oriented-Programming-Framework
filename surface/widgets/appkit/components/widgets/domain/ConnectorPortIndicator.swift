// ============================================================
// Clef Surface AppKit Widget — ConnectorPortIndicator
//
// Visual indicator for a ConnectorPort on a canvas item. Shows
// direction via color (blue=in, orange=out, green=bidirectional),
// optional label, and connection count badge.
// ============================================================

import AppKit

public enum ClefPortDirection: String {
    case `in` = "in"
    case out = "out"
    case bidirectional = "bidirectional"

    public var color: NSColor {
        switch self {
        case .in: return NSColor(calibratedRed: 0.129, green: 0.588, blue: 0.953, alpha: 1.0) // #2196F3
        case .out: return NSColor(calibratedRed: 1.0, green: 0.596, blue: 0.0, alpha: 1.0) // #FF9800
        case .bidirectional: return NSColor(calibratedRed: 0.298, green: 0.686, blue: 0.314, alpha: 1.0) // #4CAF50
        }
    }
}

public enum ClefPortSide: String {
    case top, right, bottom, left, center
}

public class ClefConnectorPortIndicatorView: NSView {
    public var portId: String = ""
    public var direction: ClefPortDirection = .in { didSet { needsDisplay = true } }
    public var portType: String? = nil
    public var label: String? = nil { didSet { needsDisplay = true } }
    public var side: ClefPortSide = .left
    public var offset: CGFloat = 0.5
    public var connectionCount: Int = 0 { didSet { needsDisplay = true } }
    public var maxConnections: Int? = nil { didSet { needsDisplay = true } }
    public var onConnectStart: (() -> Void)?

    private var isHovered = false { didSet { needsDisplay = true } }
    private var trackingArea: NSTrackingArea?

    private static let dotRadius: CGFloat = 5
    private static let hoverRadius: CGFloat = 8

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        setAccessibilityRole(.image)
        updateAccessibilityLabel()
    }

    public override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let existing = trackingArea { removeTrackingArea(existing) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    public override func mouseEntered(with event: NSEvent) { isHovered = true }
    public override func mouseExited(with event: NSEvent) { isHovered = false }

    public override func mouseDown(with event: NSEvent) {
        onConnectStart?()
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard let ctx = NSGraphicsContext.current?.cgContext else { return }

        let isFull = maxConnections != nil && connectionCount >= maxConnections!
        let radius = isHovered ? Self.hoverRadius : Self.dotRadius
        let center = NSPoint(x: bounds.midX, y: bounds.midY)

        // Port dot
        let dotColor = isFull ? direction.color.withAlphaComponent(0.4) : direction.color
        ctx.setFillColor(dotColor.cgColor)
        ctx.fillEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))

        // Border ring
        ctx.setStrokeColor(NSColor.controlBackgroundColor.cgColor)
        ctx.setLineWidth(1.5)
        ctx.strokeEllipse(in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))

        // Label (shown on hover)
        if isHovered, let label = label {
            let attrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 10, weight: .medium),
                .foregroundColor: NSColor.labelColor,
            ]
            let labelStr = label as NSString
            let size = labelStr.size(withAttributes: attrs)
            let labelX = center.x + radius + 4
            let labelY = center.y - size.height / 2
            labelStr.draw(at: NSPoint(x: labelX, y: labelY), withAttributes: attrs)
        }

        // Connection count badge
        if connectionCount > 0 {
            let badgeText: String
            if let max = maxConnections { badgeText = "\(connectionCount)/\(max)" }
            else { badgeText = "\(connectionCount)" }
            let badgeAttrs: [NSAttributedString.Key: Any] = [
                .font: NSFont.systemFont(ofSize: 8, weight: .bold),
                .foregroundColor: NSColor.white,
            ]
            let badgeStr = badgeText as NSString
            let badgeSize = badgeStr.size(withAttributes: badgeAttrs)
            let badgeRect = CGRect(x: center.x + radius - 2, y: center.y + radius - 2,
                                   width: badgeSize.width + 6, height: badgeSize.height + 2)
            ctx.setFillColor(NSColor.systemGray.cgColor)
            ctx.fillEllipse(in: badgeRect)
            badgeStr.draw(at: NSPoint(x: badgeRect.origin.x + 3, y: badgeRect.origin.y + 1), withAttributes: badgeAttrs)
        }
    }

    private func updateAccessibilityLabel() {
        var desc = "\(direction.rawValue) port"
        if let label = label { desc += ": \(label)" }
        desc += " (\(connectionCount)"
        if let max = maxConnections { desc += "/\(max)" }
        desc += " connections)"
        setAccessibilityLabel(desc)
    }
}
