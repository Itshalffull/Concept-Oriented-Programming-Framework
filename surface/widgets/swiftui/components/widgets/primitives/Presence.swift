// ============================================================
// Clef Surface SwiftUI Widget — Presence
//
// Controls conditional rendering of children based on the
// present flag. Supports animated enter/exit transitions.
// ForceMount keeps content in the view hierarchy even when
// not visible.
//
// Adapts the presence.widget spec: anatomy (root), states
// (unmounted, mounting, mounted, unmounting), and connect
// attributes (data-part, data-state, data-present)
// to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Presence view that conditionally renders its content with
/// optional enter/exit animations.
///
/// - Parameters:
///   - present: Whether the content should be visible.
///   - animateOnMount: Whether to animate the initial appearance.
///   - forceMount: Force the content to remain in the view hierarchy.
///   - content: Content to conditionally render.
struct PresenceView<Content: View>: View {
    var present: Bool = false
    var animateOnMount: Bool = false
    var forceMount: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        if forceMount {
            content
                .opacity(present ? 1 : 0)
                .animation(.easeInOut(duration: 0.2), value: present)
        } else if present {
            if animateOnMount {
                content
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                content
            }
        }
    }
}
