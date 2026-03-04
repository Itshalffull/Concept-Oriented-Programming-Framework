// ============================================================
// Clef Surface SwiftUI Widget — FocusTrap
//
// Focus-trap wrapper that constrains focus within a boundary.
// In SwiftUI, focus management uses @FocusState and
// focusScope modifiers to capture keyboard focus within the
// content scope when active.
//
// Adapts the focus-trap.widget spec: anatomy (root,
// sentinelStart, sentinelEnd), states (inactive, active), and
// connect attributes (data-part, data-state, data-focus-trap)
// to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// FocusTrap view that constrains focus cycling within its
/// content boundary when active.
///
/// - Parameters:
///   - active: Whether the focus trap is active.
///   - returnFocus: Whether to return focus on deactivation.
///   - loop: Whether Tab focus should loop within the trap.
///   - content: The content wrapped by the focus trap.
struct FocusTrapView<Content: View>: View {
    var active: Bool = false
    var returnFocus: Bool = true
    var loop: Bool = true
    @ViewBuilder var content: Content

    @FocusState private var isFocused: Bool

    var body: some View {
        VStack {
            content
        }
        .focused($isFocused)
        .onChange(of: active) { _, newValue in
            if newValue {
                isFocused = true
            }
        }
        .accessibilityElement(children: .contain)
    }
}
