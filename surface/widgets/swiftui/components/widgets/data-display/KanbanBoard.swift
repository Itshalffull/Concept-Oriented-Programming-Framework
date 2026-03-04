// ============================================================
// Clef Surface SwiftUI Widget — KanbanBoard
//
// Multi-column kanban board with draggable cards between
// columns. Each column has a title and a list of cards.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct KanbanCard: Identifiable {
    let id: String
    let title: String
    var description: String? = nil
}

struct KanbanColumn: Identifiable {
    let id: String
    let title: String
    var cards: [KanbanCard]
}

// --------------- Component ---------------

/// KanbanBoard view with multi-column card layout.
///
/// - Parameters:
///   - columns: Array of kanban columns.
///   - onCardSelect: Callback when a card is selected.
///   - onCardMove: Callback when a card is moved between columns.
struct KanbanBoardView: View {
    var columns: [KanbanColumn]
    var onCardSelect: ((KanbanCard) -> Void)? = nil
    var onCardMove: ((String, String, String) -> Void)? = nil

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 16) {
                ForEach(columns) { column in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(column.title)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            Spacer()
                            Text("\(column.cards.count)")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        ForEach(column.cards) { card in
                            SwiftUI.Button(action: { onCardSelect?(card) }) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(card.title)
                                        .font(.subheadline)
                                        .foregroundColor(.primary)
                                    if let description = card.description {
                                        Text(description)
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                            .lineLimit(2)
                                    }
                                }
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(.systemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                .shadow(radius: 1)
                            }
                            .buttonStyle(.plain)
                        }

                        Spacer()
                    }
                    .frame(width: 260)
                    .padding(12)
                    .background(Color(.systemGray6))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(.horizontal, 16)
        }
    }
}
