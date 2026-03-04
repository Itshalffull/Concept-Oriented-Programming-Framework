// ============================================================
// Clef Surface SwiftUI Widget — CommandPalette
//
// Searchable command launcher overlay. Displays a text input
// with a filtered list of commands/actions. Supports keyboard
// shortcut hints and grouping.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct CommandPaletteItem: Identifiable {
    let id: String
    let label: String
    var group: String? = nil
    var shortcut: String? = nil
    var disabled: Bool = false
}

// --------------- Component ---------------

/// CommandPalette view for searchable command launching.
///
/// - Parameters:
///   - open: Binding to whether the palette is visible.
///   - items: Available command items.
///   - placeholder: Placeholder text for the search input.
///   - onSelect: Callback when a command is selected.
///   - onClose: Callback when the palette is dismissed.
struct CommandPaletteView: View {
    @Binding var open: Bool
    var items: [CommandPaletteItem]
    var placeholder: String = "Type a command..."
    var onSelect: ((CommandPaletteItem) -> Void)? = nil
    var onClose: (() -> Void)? = nil

    @State private var searchText: String = ""

    private var filtered: [CommandPaletteItem] {
        if searchText.isEmpty { return items }
        return items.filter { $0.label.localizedCaseInsensitiveContains(searchText) }
    }

    private var groupedItems: [(String?, [CommandPaletteItem])] {
        var groups: [(String?, [CommandPaletteItem])] = []
        var currentGroup: String? = nil
        var currentItems: [CommandPaletteItem] = []

        for item in filtered {
            if item.group != currentGroup {
                if !currentItems.isEmpty {
                    groups.append((currentGroup, currentItems))
                }
                currentGroup = item.group
                currentItems = [item]
            } else {
                currentItems.append(item)
            }
        }
        if !currentItems.isEmpty {
            groups.append((currentGroup, currentItems))
        }
        return groups
    }

    var body: some View {
        if open {
            VStack(spacing: 0) {
                // Search input
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(.secondary)
                    TextField(placeholder, text: $searchText)
                        .textFieldStyle(.plain)
                }
                .padding(12)

                Divider()

                // Results
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        if filtered.isEmpty {
                            Text("No results found")
                                .font(.body)
                                .foregroundColor(.secondary)
                                .padding(12)
                        } else {
                            ForEach(groupedItems, id: \.0) { group, groupItems in
                                if let group = group {
                                    Text(group)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .padding(.horizontal, 12)
                                        .padding(.top, 8)
                                }
                                ForEach(groupItems) { item in
                                    SwiftUI.Button(action: {
                                        guard !item.disabled else { return }
                                        onSelect?(item)
                                        open = false
                                    }) {
                                        HStack {
                                            Text(item.label)
                                                .foregroundColor(item.disabled ? .gray : .primary)
                                            Spacer()
                                            if let shortcut = item.shortcut {
                                                Text(shortcut)
                                                    .font(.caption)
                                                    .foregroundColor(.secondary)
                                            }
                                        }
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .contentShape(Rectangle())
                                    }
                                    .buttonStyle(.plain)
                                    .disabled(item.disabled)
                                }
                            }
                        }
                    }
                }
                .frame(maxHeight: 300)
            }
            .background(Color(.systemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(radius: 20)
            .padding(40)
        }
    }
}
