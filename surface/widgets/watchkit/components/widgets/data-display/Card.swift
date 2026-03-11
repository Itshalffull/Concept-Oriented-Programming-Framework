// ============================================================
// Clef Surface WatchKit Widget — Card
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CardView: View {
    var title: String = ""; var subtitle: String = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption.bold()); Text(subtitle).font(.caption2).foregroundColor(.secondary)
        }.padding(8).background(Color.gray.opacity(0.1)).cornerRadius(8)
    }
}
