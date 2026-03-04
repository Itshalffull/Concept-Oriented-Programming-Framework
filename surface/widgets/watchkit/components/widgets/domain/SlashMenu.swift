// ============================================================
// Clef Surface WatchKit Widget - SlashMenu
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SlashMenuView: View {
    var commands: [(label: String, icon: String)] = []; var onSelect: (Int) -> Void = { _ in }
    var body: some View {
        VStack(spacing: 0) { ForEach(0..<commands.count, id: \.self) { i in
            Button(action: { onSelect(i) }) { Label(commands[i].label, systemImage: commands[i].icon).font(.caption2).frame(maxWidth: .infinity, alignment: .leading) }
                .padding(.vertical, 4)
        } }.padding(4).background(Color(.darkGray)).cornerRadius(8)
    }
}
