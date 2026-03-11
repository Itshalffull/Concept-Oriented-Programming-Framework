// ============================================================
// Clef Surface WatchKit Widget — Toolbar
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ToolbarView: View {
    var items: [(icon: String, label: String, action: () -> Void)]
    var body: some View {
        HStack(spacing: 8) { ForEach(0..<items.count, id: \.self) { i in Button(action: items[i].action) { Image(systemName: items[i].icon).font(.caption) }.help(items[i].label) } }
    }
}
