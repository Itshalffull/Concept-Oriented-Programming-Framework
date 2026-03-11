// ============================================================
// Clef Surface SwiftUI Widget — List
//
// Scrollable list of items with optional selection and
// dividers. Uses SwiftUI List for native list behavior.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ListItemData: Identifiable {
    let id: String
    let title: String
    var subtitle: String? = nil
    var icon: String? = nil
}

// --------------- Component ---------------

/// ListView for scrollable item lists.
///
/// - Parameters:
///   - items: Array of list items.
///   - selectable: Whether items are selectable.
///   - onSelect: Callback when an item is selected.
struct ListView: View {
    var items: [ListItemData]
    var selectable: Bool = false
    var onSelect: ((ListItemData) -> Void)? = nil

    var body: some View {
        SwiftUI.List {
            ForEach(items) { item in
                SwiftUI.Button(action: { onSelect?(item) }) {
                    HStack(spacing: 12) {
                        if let icon = item.icon {
                            Image(systemName: icon)
                                .foregroundColor(.accentColor)
                                .frame(width: 24)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                                .font(.body)
                            if let subtitle = item.subtitle {
                                Text(subtitle)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .listStyle(.plain)
    }
}
