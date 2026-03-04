// ============================================================
// Clef Surface Wear Compose Widget - Drawer
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
fun Drawer(
    title: String = "",
    isOpen: Boolean = false,
    onClose: () -> Unit = {},
    content: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (isOpen) {
        ScalingLazyColumn(modifier = modifier.fillMaxSize()) {
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    CompactChip(onClick = onClose, label = { Text("X", fontSize = 10.sp) })
                }
            }
            item { content() }
        }
    }
}
