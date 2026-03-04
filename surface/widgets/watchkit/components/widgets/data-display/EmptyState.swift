// ============================================================
// Clef Surface WatchKit Widget — EmptyState
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct EmptyStateView: View {
    var icon: String = "tray"; var title: String = "No data"; var message: String = ""
    var body: some View {
        VStack(spacing: 8) { Image(systemName: icon).font(.title3).foregroundColor(.secondary); Text(title).font(.caption.bold()); Text(message).font(.caption2).foregroundColor(.secondary) }
    }
}
