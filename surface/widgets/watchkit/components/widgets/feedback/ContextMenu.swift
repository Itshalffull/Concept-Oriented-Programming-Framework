// ============================================================
// Clef Surface WatchKit Widget — ContextMenu
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ContextMenuView<Content: View>: View {
    var items: [(label: String, icon: String, action: () -> Void)]
    @ViewBuilder var content: () -> Content
    var body: some View {
        content().contextMenu {
            ForEach(0..<items.count, id: \.self) { i in
                Button(action: items[i].action) { Label(items[i].label, systemImage: items[i].icon) }
            }
        }
    }
}
