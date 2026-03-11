// ============================================================
// Clef Surface SwiftUI Widget — CardGrid
//
// Responsive grid of cards using LazyVGrid. Supports
// configurable column count and spacing.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct CardGridItem: Identifiable {
    let id: String
    let title: String
    var description: String? = nil
}

// --------------- Component ---------------

/// CardGrid view for responsive card layouts.
///
/// - Parameters:
///   - items: Array of card items.
///   - columns: Number of columns.
///   - spacing: Spacing between cards.
///   - onSelect: Callback when a card is selected.
struct CardGridView: View {
    var items: [CardGridItem]
    var columns: Int = 2
    var spacing: CGFloat = 16
    var onSelect: ((CardGridItem) -> Void)? = nil

    private var gridColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: spacing), count: columns)
    }

    var body: some View {
        LazyVGrid(columns: gridColumns, spacing: spacing) {
            ForEach(items) { item in
                SwiftUI.Button(action: { onSelect?(item) }) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.title)
                            .font(.headline)
                            .foregroundColor(.primary)

                        if let description = item.description {
                            Text(description)
                                .font(.body)
                                .foregroundColor(.secondary)
                                .lineLimit(3)
                        }
                    }
                    .padding(16)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color(.systemGray4), lineWidth: 1)
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }
}
