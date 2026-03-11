// ============================================================
// Clef Surface WatchKit Widget — FloatingToolbar
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FloatingToolbarView: View {
    var items: [(icon: String, action: () -> Void)]; var visible: Bool = true
    var body: some View {
        if visible {
            HStack(spacing: 8) { ForEach(0..<items.count, id: \.self) { i in Button(action: items[i].action) { Image(systemName: items[i].icon).font(.caption) } } }
            .padding(6).background(Color(.darkGray)).cornerRadius(8)
        }
    }
}
