// ============================================================
// Clef Surface SwiftUI Widget — Form
//
// Form container that groups form controls with validation
// and submission support. Renders children in a vertical
// layout with optional title and submit button.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Form view container with optional title and submit action.
///
/// - Parameters:
///   - title: Optional form title.
///   - submitLabel: Label for the submit button.
///   - disabled: Whether the form is disabled.
///   - onSubmit: Callback when the form is submitted.
///   - content: Form controls rendered within the form.
struct FormView<Content: View>: View {
    var title: String? = nil
    var submitLabel: String = "Submit"
    var disabled: Bool = false
    var onSubmit: (() -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let title = title {
                Text(title)
                    .font(.title3)
                    .fontWeight(.semibold)
            }

            content
                .disabled(disabled)

            if let onSubmit = onSubmit {
                SwiftUI.Button(action: onSubmit) {
                    Text(submitLabel)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(disabled)
            }
        }
        .padding(16)
    }
}
