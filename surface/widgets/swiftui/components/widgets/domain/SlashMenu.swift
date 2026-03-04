// ============================================================
// Clef Surface SwiftUI Widget — SlashMenu
//
// Filterable block-type palette triggered by "/" input in a
// block editor. Renders as a surface with a search field
// and filterable list of items. Selecting an item invokes the
// callback.
// ============================================================

import SwiftUI

struct SlashMenuItem: Identifiable {
    let id: String
    let label: String
    var description: String? = nil
    var shortcut: String? = nil
}

struct SlashMenuView: View {
    var query: String = ""
    var items: [SlashMenuItem]
    var onSelect: (SlashMenuItem) -> Void = { _ in }
    var onClose: () -> Void = {}

    @State private var localQuery: String = ""
    @State private var highlightIndex: Int = 0

    private var filtered: [SlashMenuItem] {
        if localQuery.trimmingCharacters(in: .whitespaces).isEmpty {
            return items
        }
        let lower = localQuery.lowercased()
        return items.filter { item in
            item.label.lowercased().contains(lower) ||
            (item.description?.lowercased().contains(lower) == true)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            // Search input
            HStack(spacing: 4) {
                Text("/")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundColor(.accentColor)

                TextField("Filter...", text: $localQuery)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: localQuery) { _ in
                        highlightIndex = 0
                    }
            }

            // Results
            if filtered.isEmpty {
                Text("No matching commands.")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(12)
            } else {
                ScrollView {
                    LazyVStack(spacing: 2) {
                        ForEach(Array(filtered.enumerated()), id: \.element.id) { index, item in
                            let isHighlighted = index == highlightIndex

                            SwiftUI.Button(action: { onSelect(item) }) {
                                HStack(spacing: 8) {
                                    Text(item.label)
                                        .font(.subheadline)
                                        .fontWeight(isHighlighted ? .bold : .regular)

                                    if let desc = item.description {
                                        Text(desc)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .lineLimit(1)
                                    }

                                    Spacer()

                                    if let shortcut = item.shortcut {
                                        Text("[\(shortcut)]")
                                            .font(.caption2)
                                            .foregroundColor(.purple)
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(
                                    RoundedRectangle(cornerRadius: 6)
                                        .fill(isHighlighted ? Color.accentColor.opacity(0.1) : Color.clear)
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(item.label)
                        }
                    }
                }
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemBackground))
                .shadow(color: Color.black.opacity(0.15), radius: 8, y: 4)
        )
        .onAppear { localQuery = query }
    }
}
