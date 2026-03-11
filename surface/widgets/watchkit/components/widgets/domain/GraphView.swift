// ============================================================
// Clef Surface WatchKit Widget - GraphView
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct GraphNodeView: View {
    var nodes: [(label: String, x: CGFloat, y: CGFloat)] = []
    var body: some View {
        ZStack {
            ForEach(0..<nodes.count, id: \.self) { i in
                Text(nodes[i].label).font(.caption2).padding(4).background(Color.gray.opacity(0.2)).cornerRadius(4)
                    .position(x: nodes[i].x, y: nodes[i].y)
            }
        }.frame(height: 100)
    }
}
