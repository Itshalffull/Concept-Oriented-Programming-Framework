// ============================================================
// Clef Surface SwiftUI Widget — MultiSelect
//
// Dropdown multi-choice selector. Displays a trigger showing
// the count of selected items with a dropdown containing
// checkbox-style items.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct MultiSelectOption: Identifiable {
    let id: String
    let label: String
    let value: String
    var disabled: Bool = false

    init(label: String, value: String, disabled: Bool = false) {
        self.id = value
        self.label = label
        self.value = value
        self.disabled = disabled
    }
}

// --------------- Component ---------------

/// MultiSelect view for dropdown multi-choice selection.
///
/// - Parameters:
///   - value: Binding to the array of selected values.
///   - options: Available options.
///   - label: Optional label text.
///   - enabled: Whether the selector is enabled.
struct MultiSelectView: View {
    @Binding var value: [String]
    var options: [MultiSelectOption]
    var label: String? = nil
    var enabled: Bool = true

    @State private var isExpanded: Bool = false

    private var displayText: String {
        switch value.count {
        case 0: return "Select..."
        case 1: return options.first(where: { $0.value == value[0] })?.label ?? value[0]
        default: return "\(value.count) selected"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            SwiftUI.Button(action: { if enabled { isExpanded.toggle() } }) {
                HStack {
                    Text(displayText)
                        .foregroundColor(value.isEmpty ? .secondary : .primary)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .foregroundColor(.secondary)
                }
                .padding(10)
                .background(Color(.systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .buttonStyle(.plain)
            .disabled(!enabled)

            if isExpanded {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(options) { option in
                        let isChecked = value.contains(option.value)
                        let isEnabled = enabled && !option.disabled

                        SwiftUI.Button(action: {
                            guard isEnabled else { return }
                            if isChecked {
                                value.removeAll { $0 == option.value }
                            } else {
                                value.append(option.value)
                            }
                        }) {
                            HStack(spacing: 8) {
                                Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                                    .foregroundColor(isEnabled ? .accentColor : .gray)
                                Text(option.label)
                                    .foregroundColor(isEnabled ? .primary : .gray)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                        .disabled(!isEnabled)
                    }
                }
                .background(Color(.systemBackground))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color(.systemGray4), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
    }
}
