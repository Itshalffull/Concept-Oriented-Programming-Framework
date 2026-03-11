// ============================================================
// Clef Surface WatchKit Widget - CanvasConnector
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CanvasConnectorView: View {
    var fromLabel: String = "A"; var toLabel: String = "B"
    var body: some View {
        HStack(spacing: 4) {
            Text(fromLabel).font(.caption2).padding(4).background(Color.gray.opacity(0.2)).cornerRadius(4)
            Image(systemName: "arrow.right").font(.caption2)
            Text(toLabel).font(.caption2).padding(4).background(Color.gray.opacity(0.2)).cornerRadius(4)
        }
    }
}
