// ============================================================
// Clef Surface SwiftUI Widget — Fieldset
//
// Group of related form controls with an optional legend/title
// and disabled state that propagates to all children.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Fieldset view grouping related form controls.
///
/// - Parameters:
///   - legend: Optional legend/title text for the fieldset.
///   - disabled: Whether all controls within are disabled.
///   - content: Form controls rendered within the fieldset.
struct FieldsetView<Content: View>: View {
    var legend: String? = nil
    var disabled: Bool = false
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let legend = legend {
                Text(legend)
                    .font(.headline)
                    .foregroundColor(disabled ? .gray : .primary)
            }

            content
                .disabled(disabled)
        }
        .padding(16)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color(.systemGray4), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel(legend ?? "Field group")
    }
}
