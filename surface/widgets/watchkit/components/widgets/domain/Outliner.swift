// ============================================================
// Clef Surface WatchKit Widget - Outliner
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct OutlinerView: View {
    var items: [(text: String, depth: Int)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 2) {
            ForEach(0..<items.count, id: \.self) { i in
                HStack { Text(items[i].text).font(.caption2) }
                    .padding(.leading, CGFloat(items[i].depth * 12))
            }
        } }
    }
}
