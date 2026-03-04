// ============================================================
// Clef Surface SwiftUI Widget — ColorLabelPicker
//
// Colored tag and label selector rendered as a grid of colored
// label chips. Supports single-select, search filtering, and
// displays a checkmark on the selected item.
// ============================================================

import SwiftUI

struct ColorLabel: Identifiable {
    var id: String { name }
    let name: String
    let color: Color
}

struct ColorLabelPickerView: View {
    var value: String? = nil
    var colors: [ColorLabel]
    var columns: Int = 4
    var onSelect: (String) -> Void = { _ in }

    @State private var filter: String = ""

    private var filtered: [ColorLabel] {
        if filter.trimmingCharacters(in: .whitespaces).isEmpty {
            return colors
        }
        return colors.filter { $0.name.localizedCaseInsensitiveContains(filter) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Filter field
            TextField("Filter colors...", text: $filter)
                .textFieldStyle(.roundedBorder)

            // Color grid
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: columns), spacing: 8) {
                ForEach(filtered) { item in
                    let isSelected = item.name == value

                    SwiftUI.Button(action: { onSelect(item.name) }) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(item.color)
                                .frame(width: 16, height: 16)

                            Text(item.name + (isSelected ? " \u{2713}" : ""))
                                .font(.caption)
                                .fontWeight(isSelected ? .bold : .regular)
                                .lineLimit(1)
                        }
                        .padding(4)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 2)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Color: \(item.name)")
                    .accessibilityAddTraits(isSelected ? .isSelected : [])
                }
            }

            if filtered.isEmpty {
                Text("No matching colors.")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemBackground))
        )
    }
}
