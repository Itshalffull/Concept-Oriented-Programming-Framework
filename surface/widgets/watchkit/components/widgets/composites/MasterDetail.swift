// ============================================================
// Clef Surface WatchKit Widget - MasterDetail
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MasterDetailView: View {
    var items: [(title: String, detail: AnyView)] = []
    var body: some View {
        List { ForEach(0..<items.count, id: \.self) { i in NavigationLink(items[i].title) { items[i].detail }.font(.caption2) } }
    }
}
