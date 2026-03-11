// ============================================================
// Clef Surface WatchKit Widget - NotificationCenter
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct NotificationCenterView: View {
    var notifications: [(title: String, message: String, isRead: Bool)] = []
    var body: some View {
        ScrollView { VStack(spacing: 4) {
            HStack { Text("Notifications").font(.caption.bold()); Spacer() }
            ForEach(0..<notifications.count, id: \.self) { i in
                VStack(alignment: .leading, spacing: 1) {
                    HStack { Text(notifications[i].title).font(.caption2.bold()); if !notifications[i].isRead { Circle().fill(Color.accentColor).frame(width: 5, height: 5) } }
                    Text(notifications[i].message).font(.caption2).foregroundColor(.secondary).lineLimit(1)
                }.padding(.vertical, 2)
            }
        } }
    }
}
