// ============================================================
// Clef Surface WatchKit Widget — NavigationMenu
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct NavigationMenuView: View {
    var items: [(label: String, destination: AnyView)]
    var body: some View {
        List { ForEach(0..<items.count, id: \.self) { i in NavigationLink(items[i].label) { items[i].destination }.font(.caption2) } }
    }
}
