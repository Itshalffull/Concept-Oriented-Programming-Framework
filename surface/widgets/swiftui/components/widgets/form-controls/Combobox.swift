// ============================================================
// Clef Surface SwiftUI Widget — Combobox
//
// Searchable single-choice selector. Combines a text input
// with a filtered dropdown list. As the user types, options
// are filtered in real time.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ComboboxOption: Identifiable {
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

/// Combobox view for searchable single-choice selection.
///
/// - Parameters:
///   - value: Binding to the selected value.
///   - options: Available options.
///   - placeholder: Placeholder text.
///   - label: Optional label text.
///   - enabled: Whether the combobox is enabled.
struct ComboboxView: View {
    @Binding var value: String?
    var options: [ComboboxOption]
    var placeholder: String = "Search..."
    var label: String? = nil
    var enabled: Bool = true

    @State private var inputText: String = ""
    @State private var isExpanded: Bool = false

    private var filtered: [ComboboxOption] {
        if inputText.isEmpty { return options }
        return options.filter { $0.label.localizedCaseInsensitiveContains(inputText) }
    }

    private var selectedLabel: String {
        options.first(where: { $0.value == value })?.label ?? ""
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            TextField(placeholder, text: Binding(
                get: { isExpanded ? inputText : selectedLabel },
                set: { newValue in
                    inputText = newValue
                    isExpanded = true
                }
            ))
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
                            SwiftUI.Button(action: {
                                value = option.value
                                inputText = ""
                                isExpanded = false
                            }) {
                                Text(option.label)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 6)
                                    .background(option.value == value ? Color.accentColor.opacity(0.1) : Color.clear)
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
