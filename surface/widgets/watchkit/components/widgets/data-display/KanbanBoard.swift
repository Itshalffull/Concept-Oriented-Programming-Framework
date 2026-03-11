// ============================================================
// Clef Surface WatchKit Widget — KanbanBoard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct KanbanBoardView: View {
    var columns: [(title: String, items: [String])]
    var body: some View {
        ScrollView(.horizontal) { HStack(alignment: .top, spacing: 8) {
            ForEach(0..<columns.count, id: \.self) { i in
                VStack(alignment: .leading, spacing: 4) {
                    Text(columns[i].title).font(.caption.bold())
                    ForEach(columns[i].items, id: \.self) { item in Text(item).font(.caption2).padding(4).background(Color.gray.opacity(0.1)).cornerRadius(4) }
                }.frame(width: 100)
            }
        } }
    }
}
