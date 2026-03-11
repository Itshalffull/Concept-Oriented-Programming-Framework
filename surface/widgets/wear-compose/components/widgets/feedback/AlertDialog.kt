// ============================================================
// Clef Surface Wear Compose Widget - AlertDialog
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
fun AlertDialog(
    title: String = "",
    message: String = "",
    confirmLabel: String = "OK",
    cancelLabel: String = "Cancel",
    onConfirm: () -> Unit = {},
    onCancel: () -> Unit = {},
    visible: Boolean = false,
    modifier: Modifier = Modifier
) {
    if (visible) {
        androidx.wear.compose.material.dialog.Alert(
            title = { Text(title, fontSize = 14.sp, fontWeight = FontWeight.Bold) },
            modifier = modifier
        ) {
            item { Text(message, fontSize = 12.sp) }
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CompactChip(onClick = onCancel, label = { Text(cancelLabel, fontSize = 10.sp) })
                    CompactChip(onClick = onConfirm, label = { Text(confirmLabel, fontSize = 10.sp) })
                }
            }
        }
    }
}
