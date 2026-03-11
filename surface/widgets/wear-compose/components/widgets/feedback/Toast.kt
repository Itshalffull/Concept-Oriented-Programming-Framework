// ============================================================
// Clef Surface Wear Compose Widget - Toast
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
fun Toast(
    message: String = "",
    variant: String = "info",
    visible: Boolean = false,
    modifier: Modifier = Modifier
) {
    if (visible) {
        val color = when (variant) {
            "error" -> androidx.compose.ui.graphics.Color.Red
            "success" -> androidx.compose.ui.graphics.Color.Green
            "warning" -> androidx.compose.ui.graphics.Color(0xFFFFA500)
            else -> androidx.compose.ui.graphics.Color.Gray
        }
        Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
            Text(message, fontSize = 11.sp, color = color)
        }
    }
}
