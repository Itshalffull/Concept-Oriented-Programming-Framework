// ============================================================
// Clef Surface WatchKit Widget — StatCard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct StatCardView: View {
    var label: String; var value: String; var trend: String = "neutral"
    private var trendColor: Color { switch trend { case "up": return .green; case "down": return .red; default: return .secondary } }
    private var trendIcon: String { switch trend { case "up": return "arrow.up"; case "down": return "arrow.down"; default: return "minus" } }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) { Text(label).font(.caption2).foregroundColor(.secondary); Text(value).font(.title3.bold()); Image(systemName: trendIcon).font(.caption2).foregroundColor(trendColor) }
        .padding(8).background(Color.gray.opacity(0.1)).cornerRadius(8)
    }
}
