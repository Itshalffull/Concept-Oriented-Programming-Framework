// ============================================================
// Clef Surface SwiftUI Widget — Select
//
// Dropdown single-choice selector using SwiftUI Picker or
// Menu. Shows a trigger displaying the selected value with a
// dropdown arrow.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct SelectOption: Identifiable {
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

/// Select view for dropdown single-choice selection.
///
/// - Parameters:
///   - value: Binding to the selected value.
///   - options: Available options.
///   - placeholder: Placeholder text.
///   - label: Optional label text.
///   - enabled: Whether the selector is enabled.
struct SelectView: View {
    @Binding var value: String?
    var options: [SelectOption]
    var placeholder: String = "Select..."
    var label: String? = nil
    var enabled: Bool = true

    private var selectedLabel: String {
        options.first(where: { $0.value == value })?.label ?? placeholder
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            Menu {
                ForEach(options) { option in
                    SwiftUI.Button(action: {
                        guard !option.disabled else { return }
                        value = option.value
                    }) {
                        HStack {
                            Text(option.label)
                            if option.value == value {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                    .disabled(option.disabled)
                }
            } label: {
                HStack {
                    Text(selectedLabel)
                        .foregroundColor(value == nil ? .secondary : .primary)
                    Spacer()
                    Image(systemName: "chevron.down")
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
            .disabled(!enabled)
        }
    }
}
