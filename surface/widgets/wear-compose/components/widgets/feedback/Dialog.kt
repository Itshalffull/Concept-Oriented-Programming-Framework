// ============================================================
// Clef Surface Wear Compose Widget - Dialog
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.feedback

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
fun ClefDialog(
    title: String = "",
    visible: Boolean = false,
    onDismiss: () -> Unit = {},
    content: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (visible) {
        androidx.wear.compose.material.dialog.Alert(
            title = { Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold) },
            modifier = modifier
        ) {
            item { content() }
            item {
                CompactChip(onClick = onDismiss, label = { Text("Close", fontSize = 10.sp) })
            }
        }
    }
}
