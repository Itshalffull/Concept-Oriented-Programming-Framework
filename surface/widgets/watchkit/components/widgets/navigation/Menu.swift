// ============================================================
// Clef Surface WatchKit Widget — Menu
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MenuView: View {
    var items: [(label: String, icon: String, action: () -> Void)]
    var body: some View {
        List { ForEach(0..<items.count, id: \.self) { i in Button(action: items[i].action) { Label(items[i].label, systemImage: items[i].icon).font(.caption2) } } }
    }
}
