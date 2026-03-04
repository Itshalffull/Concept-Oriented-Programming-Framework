// ============================================================
// Clef Surface WatchKit Widget - SortBuilder
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SortBuilderView: View {
    var criteria: [(field: String, direction: String)] = []
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Sort").font(.caption.bold())
            ForEach(0..<criteria.count, id: \.self) { i in
                HStack { Text(criteria[i].field).font(.caption2); Image(systemName: criteria[i].direction == "asc" ? "arrow.up" : "arrow.down").font(.caption2) }
                    .padding(3).background(Color.gray.opacity(0.1)).cornerRadius(4)
            }
        }
    }
}
