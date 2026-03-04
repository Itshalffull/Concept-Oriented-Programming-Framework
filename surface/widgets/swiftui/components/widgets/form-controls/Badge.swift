// ============================================================
// Clef Surface SwiftUI Widget — Badge
//
// Compact status indicator or count display. Renders as a
// colored label with filled, outline, or subtle variants.
// Maps the badge.widget anatomy (root, label) to SwiftUI
// Text with background and border support.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum BadgeVariant { case filled, outline, subtle }
enum BadgeSize {
    case sm, md, lg

    var horizontalPadding: CGFloat {
        switch self {
        case .sm: return 4
        case .md: return 8
        case .lg: return 12
        }
    }

    var verticalPadding: CGFloat {
        switch self {
        case .sm: return 0
        case .md: return 2
        case .lg: return 4
        }
    }

    var fontSize: CGFloat {
        switch self {
        case .sm: return 10
        case .md: return 12
        case .lg: return 14
        }
    }
}

// --------------- Component ---------------

/// Badge view rendering a compact status indicator or count.
///
/// - Parameters:
///   - text: Display text of the badge.
///   - variant: Visual variant: filled, outline, or subtle.
///   - size: Size controlling padding and font.
///   - color: Primary color for the badge.
struct BadgeView: View {
    var text: String
    var variant: BadgeVariant = .filled
    var size: BadgeSize = .md
    var color: Color = .accentColor

    private var containerColor: Color {
        switch variant {
        case .filled: return color
        case .outline: return .clear
        case .subtle: return color.opacity(0.12)
        }
    }

    private var contentColor: Color {
        switch variant {
        case .filled: return .white
        case .outline: return color
        case .subtle: return color
        }
    }

    var body: some View {
        Text(text)
            .font(.system(size: size.fontSize, weight: .medium))
            .foregroundColor(contentColor)
            .padding(.horizontal, size.horizontalPadding)
            .padding(.vertical, size.verticalPadding)
            .background(containerColor)
            .clipShape(RoundedRectangle(cornerRadius: 4))
            .overlay(
                RoundedRectangle(cornerRadius: 4)
                    .stroke(variant == .outline ? color : .clear, lineWidth: 1)
            )
            .accessibilityLabel(text)
    }
}
