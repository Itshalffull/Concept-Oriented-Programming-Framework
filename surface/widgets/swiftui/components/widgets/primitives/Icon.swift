// ============================================================
// Clef Surface SwiftUI Widget — Icon
//
// Renders a named icon using SF Symbols. Maps common icon names
// to their SF Symbols equivalents. Unknown names fall back to a
// generic diamond glyph. Supports an accessible label for
// semantic icons.
//
// Adapts the icon.widget spec: anatomy (root), states (static),
// and connect attributes (data-part, data-icon, data-size,
// role, aria-hidden, aria-label) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Icon Map ---------------

private let iconMap: [String: String] = [
    "check": "checkmark",
    "close": "xmark",
    "x": "xmark",
    "arrow-right": "arrow.right",
    "arrow-left": "arrow.left",
    "arrow-up": "arrow.up",
    "arrow-down": "arrow.down",
    "chevron-right": "chevron.right",
    "chevron-left": "chevron.left",
    "chevron-up": "chevron.up",
    "chevron-down": "chevron.down",
    "plus": "plus",
    "minus": "minus",
    "search": "magnifyingglass",
    "star": "star.fill",
    "star-outline": "star",
    "heart": "heart.fill",
    "heart-outline": "heart",
    "info": "info.circle.fill",
    "warning": "exclamationmark.triangle.fill",
    "error": "exclamationmark.circle.fill",
    "success": "checkmark.circle.fill",
    "home": "house.fill",
    "settings": "gearshape.fill",
    "edit": "pencil",
    "delete": "trash.fill",
    "trash": "trash.fill",
    "copy": "doc.on.doc",
    "link": "link",
    "external-link": "arrow.up.right.square",
    "mail": "envelope.fill",
    "lock": "lock.fill",
    "unlock": "lock.open.fill",
    "eye": "eye.fill",
    "eye-off": "eye.slash.fill",
    "menu": "line.3.horizontal",
    "more": "ellipsis",
    "refresh": "arrow.clockwise",
    "download": "arrow.down.circle",
    "upload": "arrow.up.circle",
    "filter": "line.3.horizontal.decrease",
    "sort": "arrow.up.arrow.down",
    "calendar": "calendar",
    "clock": "clock",
    "user": "person.fill",
    "folder": "folder.fill",
    "file": "doc.fill",
]

// --------------- Types ---------------

enum ClefIconSize: String {
    case sm, md, lg

    var points: CGFloat {
        switch self {
        case .sm: return 16
        case .md: return 24
        case .lg: return 32
        }
    }
}

// --------------- Component ---------------

/// Icon view that renders a named icon from SF Symbols,
/// or a fallback Unicode glyph for unknown names.
///
/// - Parameters:
///   - name: Named icon to render (e.g. "check", "home", "search").
///   - size: Size of the icon: sm, md, or lg.
///   - color: Optional tint color for the icon.
///   - label: Accessible label making the icon semantic.
///   - decorative: Whether the icon is purely decorative.
struct ClefIconView: View {
    var name: String = ""
    var size: ClefIconSize = .md
    var color: Color = .primary
    var label: String? = nil
    var decorative: Bool = true

    var body: some View {
        if let sfName = iconMap[name.lowercased()] {
            Image(systemName: sfName)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size.points, height: size.points)
                .foregroundColor(color)
                .accessibilityLabel(accessibilityText)
                .accessibilityHidden(decorative && label == nil)
        } else {
            // Fallback: render a Unicode glyph
            Text("\u{25C6}")
                .font(.system(size: size.points))
                .foregroundColor(color)
                .accessibilityLabel(accessibilityText)
                .accessibilityHidden(decorative && label == nil)
        }
    }

    private var accessibilityText: String {
        if !decorative, let label = label {
            return label
        }
        return name
    }
}
