// ============================================================
// Clef Surface WatchKit Widget - FilterBuilder
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FilterBuilderView: View {
    var filters: [(field: String, op: String, value: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            Text("Filters").font(.caption.bold())
            ForEach(0..<filters.count, id: \.self) { i in
                HStack { Text(filters[i].field).font(.caption2); Text(filters[i].op).font(.caption2); Text(filters[i].value).font(.caption2.bold()) }
                    .padding(3).background(Color.gray.opacity(0.1)).cornerRadius(4)
            }
        } }
    }
}
