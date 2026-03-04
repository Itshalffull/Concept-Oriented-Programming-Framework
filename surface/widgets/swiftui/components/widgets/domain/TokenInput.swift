// ============================================================
// Clef Surface SwiftUI Widget — TokenInput
//
// Token pill input rendered as a flow of chips with a TextField
// for adding new tokens. Existing tokens display as removable
// chips. Typing filters available suggestions shown in a list.
// ============================================================

import SwiftUI

struct TokenInputView: View {
    var tokens: [String]
    var suggestions: [String] = []
    var onAdd: (String) -> Void = { _ in }
    var onRemove: (String) -> Void = { _ in }

    @State private var inputValue: String = ""
    @State private var showSuggestions: Bool = false

    private var filteredSuggestions: [String] {
        guard !inputValue.trimmingCharacters(in: .whitespaces).isEmpty else { return [] }
        let lower = inputValue.lowercased()
        return suggestions
            .filter { $0.lowercased().contains(lower) && !tokens.contains($0) }
            .prefix(5)
            .map { $0 }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Token chips
            FlowLayoutView(spacing: 4) {
                ForEach(tokens, id: \.self) { token in
                    HStack(spacing: 4) {
                        Text(token)
                            .font(.subheadline)
                            .fontWeight(.medium)

                        SwiftUI.Button(action: { onRemove(token) }) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove \(token)")
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(
                        Capsule()
                            .fill(Color(.systemGray5))
                    )
                }
            }

            // Input field
            VStack(alignment: .leading, spacing: 0) {
                TextField("Add token...", text: $inputValue)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: inputValue) { newVal in
                        showSuggestions = !newVal.trimmingCharacters(in: .whitespaces).isEmpty
                    }
                    .onSubmit {
                        let trimmed = inputValue.trimmingCharacters(in: .whitespaces)
                        if !trimmed.isEmpty {
                            onAdd(trimmed)
                            inputValue = ""
                            showSuggestions = false
                        }
                    }

                if showSuggestions && !filteredSuggestions.isEmpty {
                    VStack(alignment: .leading, spacing: 0) {
                        ForEach(filteredSuggestions, id: \.self) { suggestion in
                            SwiftUI.Button(action: {
                                onAdd(suggestion)
                                inputValue = ""
                                showSuggestions = false
                            }) {
                                Text(suggestion)
                                    .font(.subheadline)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)

                            Divider()
                        }
                    }
                    .background(
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color(.systemBackground))
                            .shadow(color: Color.black.opacity(0.1), radius: 4, y: 2)
                    )
                }
            }
        }
        .padding(8)
    }
}

/// Simple flow layout for token chips
private struct FlowLayoutView<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    var body: some View {
        // Use built-in layout; wrap with AnyLayout if available
        let layout = HStack(spacing: spacing) { content }
        layout
    }
}
