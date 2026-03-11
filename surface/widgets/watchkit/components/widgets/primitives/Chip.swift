// ============================================================
// Clef Surface WatchKit Widget — Chip
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ChipView: View {
    var label: String
    var selected: Bool = false
    var onTap: () -> Void = {}
    var body: some View {
        Text(label).font(.caption2)
            .padding(.horizontal, 8).padding(.vertical, 4)
            .background(selected ? Color.accentColor.opacity(0.2) : Color.gray.opacity(0.2))
            .cornerRadius(12)
            .onTapGesture { onTap() }
    }
}
