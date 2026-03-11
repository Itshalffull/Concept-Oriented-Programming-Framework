// ============================================================
// Clef Surface WatchKit Widget — CardGrid
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CardGridView: View {
    var items: [(title: String, subtitle: String)]
    var body: some View {
        ScrollView { LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            ForEach(0..<items.count, id: \.self) { i in CardView(title: items[i].title, subtitle: items[i].subtitle) }
        } }
    }
}
