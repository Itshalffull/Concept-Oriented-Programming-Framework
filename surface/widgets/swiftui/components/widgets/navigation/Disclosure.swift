// ============================================================
// Clef Surface SwiftUI Widget — Disclosure
//
// Single collapsible section with a trigger and expandable
// content panel using SwiftUI DisclosureGroup.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Disclosure view with a single collapsible section.
///
/// - Parameters:
///   - title: Trigger heading text.
///   - expanded: Binding to the expanded state.
///   - content: Content shown when expanded.
struct DisclosureView<Content: View>: View {
    var title: String
    @Binding var expanded: Bool
    @ViewBuilder var content: Content

    var body: some View {
        DisclosureGroup(title, isExpanded: $expanded) {
            content
        }
        .accessibilityLabel(title)
    }
}
