// ============================================================
// Clef Surface SwiftUI Widget — Checkbox
//
// Boolean toggle control. Supports checked, unchecked, and
// indeterminate states with an optional label and required-field
// indicator.
//
// Adapts the checkbox.widget spec: anatomy (root, input,
// control, indicator, label), states (unchecked, checked,
// indeterminate, disabled, focused), and connect attributes
// (data-part, data-state, data-disabled) to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// Checkbox view that renders a toggle control with an optional
/// label. Supports controlled checked state as well as the
/// indeterminate tri-state.
///
/// - Parameters:
///   - checked: Whether the checkbox is checked.
///   - indeterminate: Whether the checkbox is in indeterminate state.
///   - disabled: Whether the checkbox is disabled.
///   - label: Label text displayed next to the checkbox.
///   - required: Whether the associated field is required.
///   - onCheckedChange: Callback when the checked value changes.
struct CheckboxView: View {
    @Binding var checked: Bool
    var indeterminate: Bool = false
    var disabled: Bool = false
    var label: String? = nil
    var required: Bool = false
    var onCheckedChange: ((Bool) -> Void)? = nil

    var body: some View {
        SwiftUI.Button(action: {
            guard !disabled else { return }
            let next = !checked
            checked = next
            onCheckedChange?(next)
        }) {
            HStack(spacing: 4) {
                Image(systemName: iconName)
                    .foregroundColor(disabled ? .gray : .accentColor)

                if let label = label {
                    HStack(spacing: 0) {
                        Text(label)
                            .foregroundColor(disabled ? .gray : .primary)
                            .font(.body)
                        if required {
                            Text(" *")
                                .foregroundColor(.red)
                                .font(.body)
                        }
                    }
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityLabel(label ?? "Checkbox")
        .accessibilityAddTraits(checked ? .isSelected : [])
    }

    private var iconName: String {
        if indeterminate {
            return "minus.square.fill"
        }
        return checked ? "checkmark.square.fill" : "square"
    }
}
