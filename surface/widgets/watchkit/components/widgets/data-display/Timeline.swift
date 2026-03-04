// ============================================================
// Clef Surface WatchKit Widget — Timeline
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TimelineView: View {
    var entries: [(title: String, description: String)]
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 8) {
            ForEach(0..<entries.count, id: \.self) { i in
                HStack(alignment: .top, spacing: 8) { Circle().fill(Color.accentColor).frame(width: 8, height: 8).padding(.top, 4)
                    VStack(alignment: .leading) { Text(entries[i].title).font(.caption.bold()); Text(entries[i].description).font(.caption2).foregroundColor(.secondary) } }
            }
        } }
    }
}
