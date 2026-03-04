// ============================================================
// Clef Surface SwiftUI Widget — MentionInput
//
// Text input with @mention autocomplete. Shows a suggestion
// dropdown when @ is typed.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct MentionSuggestion: Identifiable {
    let id: String
    let name: String
    var avatar: String? = nil
}

// --------------- Component ---------------

/// MentionInput view with @mention autocomplete.
///
/// - Parameters:
///   - value: Binding to the text value.
///   - suggestions: Available mention suggestions.
///   - placeholder: Placeholder text.
///   - enabled: Whether the input is enabled.
///   - onMention: Callback when a mention is selected.
struct MentionInputView: View {
    @Binding var value: String
    var suggestions: [MentionSuggestion]
    var placeholder: String = "Type @ to mention..."
    var enabled: Bool = true
    var onMention: ((MentionSuggestion) -> Void)? = nil

    @State private var showSuggestions: Bool = false
    @State private var searchText: String = ""

    private var filteredSuggestions: [MentionSuggestion] {
        if searchText.isEmpty { return suggestions }
        return suggestions.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            TextField(placeholder, text: $value)
                .textFieldStyle(.roundedBorder)
                .disabled(!enabled)
                .onChange(of: value) { _, newValue in
                    if let atIndex = newValue.lastIndex(of: "@") {
                        let afterAt = String(newValue[newValue.index(after: atIndex)...])
                        searchText = afterAt
                        showSuggestions = true
                    } else {
                        showSuggestions = false
                    }
                }

            if showSuggestions && !filteredSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(filteredSuggestions) { suggestion in
                        SwiftUI.Button(action: {
                            // Replace @search with @name
                            if let atIndex = value.lastIndex(of: "@") {
                                value = String(value[..<atIndex]) + "@\(suggestion.name) "
                            }
                            showSuggestions = false
                            onMention?(suggestion)
                        }) {
                            HStack(spacing: 8) {
                                Text(String(suggestion.name.prefix(1)))
                                    .font(.caption)
                                    .frame(width: 24, height: 24)
                                    .background(Color(.systemGray5))
                                    .clipShape(Circle())
                                Text(suggestion.name)
                                    .font(.body)
                            }
                            .padding(.horizontal, 8)
                            .padding(.vertical, 6)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .buttonStyle(.plain)
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
