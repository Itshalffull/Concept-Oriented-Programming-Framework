// ============================================================
// Clef Surface WatchKit Widget — CommandPalette
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CommandPaletteView: View {
    var commands: [(label: String, action: () -> Void)]
    @State private var search = ""
    var filtered: [(label: String, action: () -> Void)] { search.isEmpty ? commands : commands.filter { $0.label.localizedCaseInsensitiveContains(search) } }
    var body: some View {
        VStack { TextField("Command...", text: $search).font(.caption2)
            List { ForEach(0..<filtered.count, id: \.self) { i in Button(filtered[i].label, action: filtered[i].action).font(.caption2) } }
        }
    }
}
