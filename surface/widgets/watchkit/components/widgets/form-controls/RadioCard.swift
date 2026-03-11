// ============================================================
// Clef Surface WatchKit Widget — RadioCard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct RadioCardView: View {
    var title: String; var subtitle: String = ""; var selected: Bool = false; var onSelect: () -> Void = {}
    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 2) { Text(title).font(.caption.bold()); if !subtitle.isEmpty { Text(subtitle).font(.caption2).foregroundColor(.secondary) } }
            .padding(8).frame(maxWidth: .infinity, alignment: .leading).background(selected ? Color.accentColor.opacity(0.15) : Color.gray.opacity(0.1)).cornerRadius(8)
        }.buttonStyle(.plain)
    }
}
