// ============================================================
// Clef Surface Compose Widget — NotificationCenter
//
// Notification feed panel with an unread count badge, list of
// notification cards with read/unread state, type indicators,
// and timestamps. Supports mark-as-read, dismiss, and clear
// actions. Renders as a LazyColumn of notification cards with
// Material 3 styling.
// Maps notification-center.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Notification(
    val id: String,
    val title: String,
    val description: String? = null,
    val time: String,
    val read: Boolean,
    val type: NotificationType,
)

enum class NotificationType { INFO, WARNING, ERROR, SUCCESS }

// --------------- Helpers ---------------

private fun notificationIcon(type: NotificationType): String = when (type) {
    NotificationType.INFO -> "\u2139"
    NotificationType.WARNING -> "\u26A0"
    NotificationType.ERROR -> "\u2716"
    NotificationType.SUCCESS -> "\u2714"
}

private fun notificationColor(type: NotificationType): Color = when (type) {
    NotificationType.INFO -> Color(0xFF2196F3)
    NotificationType.WARNING -> Color(0xFFFF9800)
    NotificationType.ERROR -> Color(0xFFF44336)
    NotificationType.SUCCESS -> Color(0xFF4CAF50)
}

// --------------- Component ---------------

/**
 * Notification center composable displaying a feed of notification
 * cards with type indicators, timestamps, read/unread state,
 * and actions for mark-as-read, dismiss, and clear all.
 *
 * @param notifications Array of notifications.
 * @param onRead Callback when a notification is marked as read.
 * @param onDismiss Callback when a notification is dismissed.
 * @param onClear Callback to clear all notifications.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun NotificationCenter(
    notifications: List<Notification>,
    onRead: ((String) -> Unit)? = null,
    onDismiss: ((String) -> Unit)? = null,
    onClear: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val unreadCount = remember(notifications) { notifications.count { !it.read } }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Notifications",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                if (unreadCount > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Badge {
                        Text("$unreadCount")
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Notification List
            if (notifications.isEmpty()) {
                Text(
                    text = "No notifications.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(notifications) { _, notif ->
                        NotificationItem(
                            notification = notif,
                            onRead = { onRead?.invoke(notif.id) },
                            onDismiss = { onDismiss?.invoke(notif.id) },
                        )
                    }
                }
            }

            // Clear All Button
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = { onClear?.invoke() },
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Text("Clear All")
            }
        }
    }
}

@Composable
private fun NotificationItem(
    notification: Notification,
    onRead: () -> Unit,
    onDismiss: () -> Unit,
) {
    val color = notificationColor(notification.type)
    val icon = notificationIcon(notification.type)

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { if (!notification.read) onRead() },
        colors = CardDefaults.cardColors(
            containerColor = if (!notification.read)
                MaterialTheme.colorScheme.surfaceContainerHigh
            else
                MaterialTheme.colorScheme.surfaceContainerLow,
        ),
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Text(
                text = icon,
                color = color,
                style = MaterialTheme.typography.bodyLarge,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = notification.title,
                        fontWeight = if (!notification.read) FontWeight.Bold else FontWeight.Normal,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.weight(1f),
                    )
                    if (!notification.read) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "\u25CF",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                Text(
                    text = notification.time,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (notification.description != null) {
                    Text(
                        text = notification.description,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.size(24.dp),
            ) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Dismiss",
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}
