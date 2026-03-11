// ============================================================
// Clef Surface SwiftUI Widget — VisuallyHidden
//
// Renders content that is invisible to sighted users but
// accessible to screen readers and VoiceOver. In SwiftUI this
// is achieved by setting the frame to zero and hiding from
// layout while keeping the accessibility label.
//
// Adapts the visually-hidden.widget spec: anatomy (root),
// states (static), and connect attributes (data-part, style)
// to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// VisuallyHidden view that renders content invisible to sighted
/// users while remaining accessible to screen readers.
///
/// - Parameters:
///   - text: Text content intended for screen readers.
struct VisuallyHiddenView: View {
    var text: String? = nil

    var body: some View {
        if let text = text {
            Text(text)
                .frame(width: 0, height: 0)
                .opacity(0)
                .accessibilityLabel(text)
                .accessibilityHidden(false)
        }
    }
}
