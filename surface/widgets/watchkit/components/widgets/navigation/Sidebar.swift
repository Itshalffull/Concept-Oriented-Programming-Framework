// ============================================================
// Clef Surface WatchKit Widget — Sidebar
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SidebarView: View {
    var items: [(id: String, label: String, icon: String)]
    var onSelect: (String) -> Void = { _ in }
    var body: some View {
        List { ForEach(items, id: \.id) { item in Button(action: { onSelect(item.id) }) { Label(item.label, systemImage: item.icon).font(.caption2) } } }
    }
}
