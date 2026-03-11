// ============================================================
// Clef Surface WatchKit Widget — DataList
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DataListView: View {
    var rows: [(label: String, value: String)]
    var body: some View {
        VStack(spacing: 4) { ForEach(0..<rows.count, id: \.self) { i in HStack { Text(rows[i].label).font(.caption2).foregroundColor(.secondary); Spacer(); Text(rows[i].value).font(.caption2) } } }
    }
}
