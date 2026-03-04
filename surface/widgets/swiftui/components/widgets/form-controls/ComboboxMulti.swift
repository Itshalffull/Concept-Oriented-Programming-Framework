// ============================================================
// Clef Surface SwiftUI Widget — ComboboxMulti
//
// Searchable multi-choice selector. Combines a text input
// with a filtered dropdown list of checkboxes. Selected values
// appear as chips above the input.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ComboboxMultiOption: Identifiable {
    let id: String
    let label: String
    let value: String

    init(label: String, value: String) {
        self.id = value
        self.label = label
        self.value = value
    }
}

// --------------- Component ---------------

/// ComboboxMulti view for searchable multi-choice selection.
///
/// - Parameters:
///   - value: Binding to the array of selected values.
///   - options: Available options.
///   - placeholder: Placeholder text.
///   - label: Optional label text.
///   - enabled: Whether the combobox is enabled.
struct ComboboxMultiView: View {
    @Binding var value: [String]
    var options: [ComboboxMultiOption]
    var placeholder: String = "Search..."
    var label: String? = nil
    var enabled: Bool = true

    @State private var inputText: String = ""
    @State private var isExpanded: Bool = false

    private var filtered: [ComboboxMultiOption] {
        if inputText.isEmpty { return options }
        return options.filter { $0.label.localizedCaseInsensitiveContains(inputText) }
    }

    private func labelFor(_ v: String) -> String {
        options.first(where: { $0.value == v })?.label ?? v
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            // Selected chips
            if !value.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(value.enumerated()), id: \.offset) { index, v in
                            HStack(spacing: 4) {
                                Text(labelFor(v))
                                    .font(.subheadline)
                                SwiftUI.Button(action: {
                                    guard enabled else { return }
                                    value.remove(at: index)
                                }) {
                                    Image(systemName: "xmark")
                                        .font(.caption2)
                                }
                                .buttonStyle(.plain)
                                .accessibilityLabel("Remove \(labelFor(v))")
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color(.systemGray5))
                            .clipShape(Capsule())
                        }
                    }
                }
            }

            TextField(placeholder, text: $inputText)
                .textFieldStyle(.roundedBorder)
                .disabled(!enabled)
                .onTapGesture { if enabled { isExpanded = true } }

            if isExpanded {
                VStack(alignment: .leading, spacing: 0) {
                    if filtered.isEmpty {
                        Text("No results found")
                            .font(.body)
                            .foregroundColor(.secondary)
                            .padding(8)
                    } else {
                        ForEach(filtered) { option in
                            let isChecked = value.contains(option.value)
                            SwiftUI.Button(action: {
                                if isChecked {
                                    value.removeAll { $0 == option.value }
                                } else {
                                    value.append(option.value)
                                }
                            }) {
                                HStack(spacing: 8) {
                                    Image(systemName: isChecked ? "checkmark.square.fill" : "square")
                                        .foregroundColor(.accentColor)
                                    Text(option.label)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                            }
                            .buttonStyle(.plain)
                        }
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
