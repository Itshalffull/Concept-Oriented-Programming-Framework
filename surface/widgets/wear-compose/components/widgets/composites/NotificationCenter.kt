// ============================================================
// Clef Surface Wear Compose Widget - NotificationCenter
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.composites

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
fun NotificationCenter(notifications: List<Triple<String, String, Boolean>> = emptyList(), onSelect: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Notifications", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(notifications.size) { i -> val (title, msg, isRead) = notifications[i]
            Chip(onClick = { onSelect(i) }, label = { Column { Text(title, fontSize = 11.sp, fontWeight = if (!isRead) FontWeight.Bold else FontWeight.Normal); Text(msg, fontSize = 9.sp, maxLines = 1) } }, modifier = Modifier.fillMaxWidth()) }
    }
}
