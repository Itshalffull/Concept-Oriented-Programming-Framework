// ============================================================
// Clef Surface SwiftUI Widget — NotificationItem
//
// Single notification entry with icon, title, description,
// timestamp, and read/unread state.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// NotificationItem view for a single notification entry.
///
/// - Parameters:
///   - title: Primary notification text.
///   - description: Optional secondary text.
///   - timestamp: Timestamp string for the notification.
///   - read: Whether the notification has been read.
///   - icon: SF Symbol name for the notification icon.
///   - onTap: Callback when the notification is tapped.
struct NotificationItemView: View {
    var title: String
    var description: String? = nil
    var timestamp: String? = nil
    var read: Bool = false
    var icon: String = "bell.fill"
    var onTap: (() -> Void)? = nil

    var body: some View {
        SwiftUI.Button(action: { onTap?() }) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: icon)
                    .foregroundColor(read ? .secondary : .accentColor)
                    .frame(width: 24, height: 24)

                VStack(alignment: .leading, spacing: 4) {
                    Text(title)
                        .font(.subheadline)
                        .fontWeight(read ? .regular : .semibold)
                        .foregroundColor(.primary)

                    if let description = description {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    if let timestamp = timestamp {
                        Text(timestamp)
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }

                Spacer()

                if !read {
                    Circle()
                        .fill(Color.accentColor)
                        .frame(width: 8, height: 8)
                }
            }
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}
