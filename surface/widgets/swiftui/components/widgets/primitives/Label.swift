// ============================================================
// Clef Surface SwiftUI Widget — Label
//
// Accessible label text for a form control. Renders label text
// with an optional red asterisk indicating required fields.
// Disabled state dims the text opacity.
//
// Adapts the label.widget spec: anatomy (root,
// requiredIndicator), states (static), and connect attributes
// (data-part, for, data-visible on requiredIndicator)
// to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Label view that renders accessible text for a form control
/// with an optional required-field indicator.
///
/// - Parameters:
///   - text: Label text content.
///   - required: Whether the associated field is required.
///   - disabled: Whether the associated control is disabled.
struct LabelView: View {
    var text: String = ""
    var required: Bool = false
    var disabled: Bool = false

    var body: some View {
        HStack(spacing: 0) {
            Text(text)
            if required {
                Text(" *")
                    .foregroundColor(.red)
            }
        }
        .font(.body)
        .foregroundColor(disabled ? .gray : .primary)
        .accessibilityLabel(text)
    }
}
