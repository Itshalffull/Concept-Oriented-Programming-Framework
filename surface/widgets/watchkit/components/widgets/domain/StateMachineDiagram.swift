// ============================================================
// Clef Surface WatchKit Widget - StateMachineDiagram
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct StateMachineDiagramView: View {
    var states: [(name: String, isCurrent: Bool)] = []; var transitions: [(from: String, to: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            ForEach(0..<states.count, id: \.self) { i in
                Text(states[i].name).font(.caption2).padding(4)
                    .background(states[i].isCurrent ? Color.accentColor.opacity(0.3) : Color.gray.opacity(0.15))
                    .cornerRadius(4)
            }
            Divider()
            ForEach(0..<transitions.count, id: \.self) { i in
                HStack { Text(transitions[i].from).font(.caption2); Image(systemName: "arrow.right").font(.caption2); Text(transitions[i].to).font(.caption2) }
            }
        } }
    }
}
