// ============================================================
// Clef Surface Wear Compose Widget - NotificationItem
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.datadisplay

import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.wear.compose.material.*
import androidx.wear.compose.foundation.lazy.*

@Composable
fun NotificationItem(
    title: String = "",
    message: String = "",
    isRead: Boolean = false,
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Chip(
        onClick = onClick,
        label = {
            Column {
                Text(title, fontSize = 11.sp, fontWeight = if (!isRead) FontWeight.Bold else FontWeight.Normal)
                Text(message, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
            }
        },
        modifier = modifier.fillMaxWidth()
    )
}
