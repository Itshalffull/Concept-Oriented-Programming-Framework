// ============================================================
// Clef Surface WatchKit Widget - PluginDetailPage
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PluginDetailPageView: View {
    var name: String; var version: String = ""; var description: String = ""; var author: String = ""
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 6) {
            Text(name).font(.headline)
            if !version.isEmpty { Text("v\(version)").font(.caption2).foregroundColor(.secondary) }
            if !author.isEmpty { Text("By \(author)").font(.caption2).foregroundColor(.secondary) }
            Divider()
            Text(description).font(.caption2)
        } }
    }
}
