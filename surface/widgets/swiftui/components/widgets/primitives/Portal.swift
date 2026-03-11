// ============================================================
// Clef Surface SwiftUI Widget — Portal
//
// In DOM environments, a portal renders children into a
// different location in the tree. In SwiftUI, overlays are
// typically handled via overlay or fullScreenCover modifiers.
// This widget wraps content in an overlay when enabled,
// rendering inline otherwise.
//
// Adapts the portal.widget spec: anatomy (root), states
// (unmounted, mounted), and connect attributes (data-part,
// data-portal, data-state) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Portal view that renders children in an overlay layer when
/// enabled, bypassing the parent layout's clipping bounds.
/// When disabled, children are rendered inline.
///
/// - Parameters:
///   - disabled: Whether the portal is disabled (renders inline).
///   - content: Content to render through the portal.
struct PortalView<Content: View>: View {
    var disabled: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        if disabled {
            content
        } else {
            Color.clear
                .frame(width: 0, height: 0)
                .overlay(
                    content
                )
        }
    }
}
