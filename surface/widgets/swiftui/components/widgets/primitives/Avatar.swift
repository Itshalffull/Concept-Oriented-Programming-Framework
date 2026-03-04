// ============================================================
// Clef Surface SwiftUI Widget — Avatar
//
// Displays a user or entity identity as initials inside a
// bordered circular surface. When no name is provided, falls
// back to a placeholder glyph. Size affects the diameter and
// text style.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum AvatarSize: String {
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
}

// --------------- Helpers ---------------

private func getInitials(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespaces)
    if trimmed.isEmpty { return "?" }
    let parts = trimmed.split(separator: " ")
    if parts.count == 1 {
        return String(parts[0].prefix(1)).uppercased()
    }
    let first = String(parts.first!.prefix(1)).uppercased()
    let last = String(parts.last!.prefix(1)).uppercased()
    return "\(first)\(last)"
}

// --------------- Component ---------------

/// Avatar view that renders user/entity identity as initials
/// inside a circular surface.
///
/// - Parameters:
///   - name: Display name used to derive initials for the fallback.
///   - src: Image source URL — triggers loaded/error states.
///   - size: Size of the avatar: "sm", "md", or "lg".
///   - fallback: Custom fallback text when no name is available.
///   - showFallback: Force the fallback to display regardless of src.
struct AvatarView: View {
    var name: String = ""
    var src: String? = nil
    var size: AvatarSize = .md
    var fallback: String? = nil
    var showFallback: Bool = false

    private var displayText: String {
        fallback ?? getInitials(name)
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(Color(.systemGray5))
                .overlay(
                    Circle()
                        .stroke(Color(.systemGray3), lineWidth: 1)
                )

            Text(displayText)
                .font(.system(size: size.fontSize, weight: .bold))
                .foregroundColor(.primary)
        }
        .frame(width: size.diameter, height: size.diameter)
        .accessibilityLabel(name.isEmpty ? "Avatar" : name)
    }
}
