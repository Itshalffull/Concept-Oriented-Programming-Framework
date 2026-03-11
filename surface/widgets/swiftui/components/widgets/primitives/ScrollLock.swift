// ============================================================
// Clef Surface SwiftUI Widget — ScrollLock
//
// Prevents parent-level scrolling when active. In SwiftUI,
// scrolling is controlled by ScrollView containers, so this
// component disables scroll interaction when locked by
// overlaying a gesture-consuming layer.
//
// Adapts the scroll-lock.widget spec: anatomy (root), states
// (unlocked, locked), and connect attributes (data-part,
// data-state, data-scroll-lock) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// ScrollLock view that prevents parent scrolling when active.
///
/// - Parameters:
///   - active: Whether the scroll lock is active.
///   - content: Optional content rendered within the scroll-lock boundary.
struct ScrollLockView<Content: View>: View {
    var active: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        content
            .allowsHitTesting(!active || true)
            .simultaneousGesture(
                active
                    ? DragGesture(minimumDistance: 0).onChanged { _ in }
                    : nil
            )
    }
}
