// ============================================================
// Clef Surface WatchKit Widget - PluginCard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PluginCardView: View {
    var name: String; var version: String = ""; var description: String = ""; var enabled: Bool = true
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(name).font(.caption.bold()); Spacer(); Text(version).font(.caption2).foregroundColor(.secondary) }
            Text(description).font(.caption2).foregroundColor(.secondary).lineLimit(2)
            HStack { Spacer(); Image(systemName: enabled ? "checkmark.circle.fill" : "xmark.circle").foregroundColor(enabled ? .green : .secondary) }
        }.padding(6).background(Color.gray.opacity(0.1)).cornerRadius(8)
    }
}
