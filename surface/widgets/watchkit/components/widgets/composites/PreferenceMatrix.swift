// ============================================================
// Clef Surface WatchKit Widget - PreferenceMatrix
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PreferenceMatrixView: View {
    var groups: [(title: String, items: [(label: String, enabled: Bool)])] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 6) {
            ForEach(0..<groups.count, id: \.self) { g in
                Text(groups[g].title).font(.caption.bold())
                ForEach(0..<groups[g].items.count, id: \.self) { i in
                    HStack { Text(groups[g].items[i].label).font(.caption2); Spacer()
                        Image(systemName: groups[g].items[i].enabled ? "checkmark" : "xmark").font(.caption2) }
                }
                Divider()
            }
        } }
    }
}
