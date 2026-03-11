// ============================================================
// Clef Surface WatchKit Widget — BacklinkPanel
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct BacklinkPanelView: View {
    var backlinks: [(title: String, excerpt: String)]
    var body: some View {
        VStack(alignment: .leading, spacing: 4) { Text("Backlinks").font(.caption.bold())
            ForEach(0..<backlinks.count, id: \.self) { i in VStack(alignment: .leading) { Text(backlinks[i].title).font(.caption2.bold()); Text(backlinks[i].excerpt).font(.caption2).foregroundColor(.secondary).lineLimit(2) }.padding(4).background(Color.gray.opacity(0.1)).cornerRadius(4) }
        }
    }
}
