// ============================================================
// Clef Surface SwiftUI Widget — NotificationCenter
//
// Notification center panel showing a list of notifications
// with read/unread states, filters, and mark-all-read action.
// ============================================================

import SwiftUI

struct NotificationEntry: Identifiable {
    let id: String
    let title: String
    var description: String? = nil
    var timestamp: String? = nil
    var read: Bool = false
    var icon: String = "bell.fill"
}

struct NotificationCenterView: View {
    @Binding var notifications: [NotificationEntry]
    var title: String = "Notifications"
    var onSelect: ((NotificationEntry) -> Void)? = nil
    var onMarkAllRead: (() -> Void)? = nil

    private var unreadCount: Int { notifications.filter { !$0.read }.count }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.headline).fontWeight(.bold)
                if unreadCount > 0 {
                    Text("\(unreadCount)").font(.caption).foregroundColor(.white)
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.accentColor).clipShape(Capsule())
                }
                Spacer()
                if let onMarkAllRead = onMarkAllRead, unreadCount > 0 {
                    SwiftUI.Button("Mark all read", action: onMarkAllRead).font(.caption)
                }
            }
            Divider()
            if notifications.isEmpty {
                VStack(spacing: 8) {
                    Image(systemName: "bell.slash").font(.title).foregroundColor(.secondary)
                    Text("No notifications").font(.body).foregroundColor(.secondary)
                }.frame(maxWidth: .infinity).padding(16)
            } else {
                ForEach(notifications) { notification in
                    SwiftUI.Button(action: { onSelect?(notification) }) {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: notification.icon).foregroundColor(notification.read ? .secondary : .accentColor).frame(width: 20)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(notification.title).font(.subheadline).fontWeight(notification.read ? .regular : .semibold)
                                if let desc = notification.description { Text(desc).font(.caption).foregroundColor(.secondary) }
                                if let ts = notification.timestamp { Text(ts).font(.caption2).foregroundColor(.secondary) }
                            }
                            Spacer()
                            if !notification.read { Circle().fill(Color.accentColor).frame(width: 6, height: 6) }
                        }.padding(.vertical, 4)
                    }.buttonStyle(.plain)
                }
            }
        }.padding(12)
    }
}
