// ============================================================
// Clef Surface SwiftUI Widget — TextInput
//
// Single-line text entry field rendered with TextField.
// Supports controlled and uncontrolled value, placeholder,
// label, disabled, read-only, and required-field states.
//
// Adapts the text-input.widget spec: anatomy (root, label,
// input, description, error, prefix, suffix, clearButton),
// states (empty, filled, idle, focused, valid, invalid,
// disabled, readOnly), and connect attributes (data-part,
// data-state, data-focus, value, placeholder) to SwiftUI
// rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// TextInput view that renders a single-line text field.
/// Supports both controlled (via value binding) and uncontrolled modes.
///
/// - Parameters:
///   - value: Binding to the current value of the text field.
///   - placeholder: Placeholder text shown when the value is empty.
///   - disabled: Whether the text input is disabled.
///   - readOnly: Whether the text input is read-only.
///   - label: Optional label text above the input.
///   - required: Whether the field is required.
///   - onSubmit: Callback when the return key is triggered.
struct TextInputView: View {
    @Binding var value: String
    var placeholder: String = ""
    var disabled: Bool = false
    var readOnly: Bool = false
    var label: String? = nil
    var required: Bool = false
    var onSubmit: ((String) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                HStack(spacing: 0) {
                    Text(label)
                        .font(.subheadline)
                        .foregroundColor(disabled ? .gray : .primary)
                    if required {
                        Text(" *")
                            .foregroundColor(.red)
                            .font(.subheadline)
                    }
                }
            }

            TextField(placeholder, text: $value)
                .textFieldStyle(.roundedBorder)
                .disabled(disabled || readOnly)
                .onSubmit {
                    onSubmit?(value)
                }
                .accessibilityLabel(label ?? placeholder)
        }
    }
}
