// ============================================================
// Clef Surface AppKit Widget — Avatar
//
// Displays a user or entity identity as initials inside a
// bordered circular view. When no name is provided, falls
// back to a placeholder glyph. Size affects diameter and
// font size.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to AppKit rendering.
// ============================================================

import AppKit

// --------------- Helpers ---------------

private enum AvatarSize {
    case sm, md, lg

    var diameter: CGFloat {
        switch self {
        case .sm: return 32
        case .md: return 40
        case .lg: return 56
        }
    }

    var fontSize: CGFloat {
        switch self {
        case .sm: return 12
        case .md: return 14
        case .lg: return 20
        }
    }

    init(string: String) {
        switch string {
        case "sm": self = .sm
        case "lg": self = .lg
        default: self = .md
        }
    }
}

private func getInitials(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespaces)
    guard !trimmed.isEmpty else { return "?" }
    let parts = trimmed.split(separator: " ")
    if parts.count == 1 {
        return String(parts[0].prefix(1)).uppercased()
    }
    let first = String(parts.first!.prefix(1)).uppercased()
    let last = String(parts.last!.prefix(1)).uppercased()
    return first + last
}

// --------------- Component ---------------

/// Avatar view that renders user/entity identity as initials
/// inside a circular surface.
public class AvatarView: NSView {
    public var name: String = "" { didSet { needsDisplay = true } }
    public var src: String? = nil { didSet { needsDisplay = true } }
    public var size: String = "md" { didSet { invalidateIntrinsicContentSize(); needsDisplay = true } }
    public var fallback: String? = nil { didSet { needsDisplay = true } }

    public override var intrinsicContentSize: NSSize {
        let config = AvatarSize(string: size)
        return NSSize(width: config.diameter, height: config.diameter)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let config = AvatarSize(string: size)
        let bounds = NSRect(x: 0, y: 0, width: config.diameter, height: config.diameter)

        // Background circle
        let path = NSBezierPath(ovalIn: bounds.insetBy(dx: 0.5, dy: 0.5))
        NSColor.controlAccentColor.withAlphaComponent(0.2).setFill()
        path.fill()
        NSColor.separatorColor.setStroke()
        path.lineWidth = 1.0
        path.stroke()

        // Initials text
        let displayText = fallback ?? getInitials(name)
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.boldSystemFont(ofSize: config.fontSize),
            .foregroundColor: NSColor.controlTextColor,
        ]
        let textSize = (displayText as NSString).size(withAttributes: attrs)
        let textOrigin = NSPoint(
            x: (config.diameter - textSize.width) / 2,
            y: (config.diameter - textSize.height) / 2
        )
        (displayText as NSString).draw(at: textOrigin, withAttributes: attrs)
    }
}
