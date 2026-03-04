// ============================================================
// Clef Surface WatchKit Widget — NotificationItem
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct NotificationItemView: View {
    var title: String; var message: String; var isRead: Bool = false
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack { Text(title).font(.caption.bold()); Spacer(); if !isRead { Circle().fill(Color.accentColor).frame(width: 6, height: 6) } }
            Text(message).font(.caption2).foregroundColor(.secondary).lineLimit(2)
        }.padding(4)
    }
}
