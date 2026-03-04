// ============================================================
// Clef Surface WatchKit Widget — DataTable
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DataTableView: View {
    var columns: [String]; var rows: [[String]]
    var body: some View {
        ScrollView { VStack(spacing: 2) {
            HStack { ForEach(columns, id: \.self) { col in Text(col).font(.system(size: 9, weight: .bold)).frame(maxWidth: .infinity) } }
            ForEach(0..<rows.count, id: \.self) { i in HStack { ForEach(0..<rows[i].count, id: \.self) { j in Text(rows[i][j]).font(.system(size: 9)).frame(maxWidth: .infinity) } } }
        } }
    }
}
