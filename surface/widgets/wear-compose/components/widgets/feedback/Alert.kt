// ============================================================
// Clef Surface Wear Compose Widget - Alert
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
fun Alert(
    title: String = "",
    message: String = "",
    variant: String = "info",
    modifier: Modifier = Modifier
) {
    val color = when (variant) {
        "error" -> androidx.compose.ui.graphics.Color.Red
        "warning" -> androidx.compose.ui.graphics.Color(0xFFFFA500)
        "success" -> androidx.compose.ui.graphics.Color.Green
        else -> androidx.compose.ui.graphics.Color.Blue
    }
    Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(8.dp)) {
            Text(title, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = color)
            if (message.isNotEmpty()) {
                Text(message, fontSize = 10.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.7f))
            }
        }
    }
}
