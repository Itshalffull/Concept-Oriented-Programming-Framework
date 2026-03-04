// ============================================================
// Clef Surface WatchKit Widget — Tooltip
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TooltipView: View {
    var text: String
    var body: some View {
        Text(text).font(.caption2).padding(6).background(Color.gray.opacity(0.8)).foregroundColor(.white).cornerRadius(6)
    }
}
