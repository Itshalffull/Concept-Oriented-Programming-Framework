// ============================================================
// Clef Surface WatchKit Widget — List
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ClefListView: View {
    var items: [String]; var onSelect: (Int) -> Void = { _ in }
    var body: some View { List { ForEach(0..<items.count, id: \.self) { i in Button(items[i], action: { onSelect(i) }).font(.caption2) } } }
}
