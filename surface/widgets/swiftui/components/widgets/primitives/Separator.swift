// ============================================================
// Clef Surface SwiftUI Widget — Separator
//
// Visual divider that separates content sections. Renders as
// a Divider (horizontal) or a vertical thin line.
// Supports custom color and thickness.
//
// Adapts the separator.widget spec: anatomy (root), states
// (static), and connect attributes (role, aria-orientation,
// data-part, data-orientation) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

enum SeparatorOrientation: String {
    case horizontal, vertical
}

// --------------- Component ---------------

/// Separator view that renders a horizontal or vertical divider.
///
/// - Parameters:
///   - orientation: Direction of the separator: horizontal or vertical.
///   - decorative: Whether the separator is purely decorative.
///   - color: Color of the separator line.
///   - thickness: Thickness of the line in points.
struct SeparatorView: View {
    var orientation: SeparatorOrientation = .horizontal
    var decorative: Bool = false
    var color: Color = Color(.separator)
    var thickness: CGFloat = 1

    var body: some View {
        Group {
            if orientation == .vertical {
                Rectangle()
                    .fill(color)
                    .frame(width: thickness)
                    .frame(maxHeight: .infinity)
            } else {
                Rectangle()
                    .fill(color)
                    .frame(height: thickness)
                    .frame(maxWidth: .infinity)
            }
        }
        .accessibilityHidden(decorative)
    }
}
