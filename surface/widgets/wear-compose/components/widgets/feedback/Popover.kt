// ============================================================
// Clef Surface Wear Compose Widget - Popover
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
fun Popover(
    isPresented: Boolean = false,
    content: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (isPresented) {
        Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
            content()
        }
    }
}
