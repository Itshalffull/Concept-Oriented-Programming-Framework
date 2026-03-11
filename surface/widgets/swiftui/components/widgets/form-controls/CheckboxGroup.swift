// ============================================================
// Clef Surface SwiftUI Widget — CheckboxGroup
//
// Multi-choice selection from a visible list of checkboxes.
// Renders Toggle or checkbox-style buttons in a vertical or
// horizontal layout. Maps the checkbox-group.widget anatomy
// (root, label, items, item, itemControl, itemLabel) to SwiftUI.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct CheckboxGroupOption: Identifiable {
    let id: String
    let label: String
    let value: String
    var disabled: Bool = false
}

enum CheckboxGroupOrientation { case horizontal, vertical }

// --------------- Component ---------------

/// CheckboxGroup view for multi-choice selection.
///
/// - Parameters:
///   - value: Binding to the set of selected values.
///   - options: Available checkbox options.
///   - label: Optional group label.
///   - orientation: Layout orientation.
///   - enabled: Whether the group is enabled.
struct CheckboxGroupView: View {
    @Binding var value: Set<String>
    var options: [CheckboxGroupOption]
    var label: String? = nil
    var orientation: CheckboxGroupOrientation = .vertical
    var enabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            let content = ForEach(options) { option in
                let isChecked = value.contains(option.value)
                let isEnabled = enabled && !option.disabled

                SwiftUI.Button(action: {
                    guard isEnabled else { return }
                    if isChecked {
                        value.remove(option.value)
                    } else {
                        value.insert(option.value)
                    }
                }) {
                    HStack(spacing: 8) {
                        Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                            .foregroundColor(isEnabled ? .accentColor : .gray)
                        Text(option.label)
                            .foregroundColor(isEnabled ? .primary : .gray)
                            .font(.body)
                    }
                }
                .buttonStyle(.plain)
                .disabled(!isEnabled)
            }

            if orientation == .horizontal {
                HStack(spacing: 16) { content }
            } else {
                VStack(alignment: .leading, spacing: 8) { content }
            }
        }
    }
}
