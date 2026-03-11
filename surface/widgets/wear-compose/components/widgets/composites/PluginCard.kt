// ============================================================
// Clef Surface Wear Compose Widget - PluginCard
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
fun PluginCard(name: String = "", version: String = "", description: String = "", enabled: Boolean = true, modifier: Modifier = Modifier) {
    Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
        Column {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(name, fontSize = 11.sp, fontWeight = FontWeight.Bold); Text(version, fontSize = 9.sp) }
            Text(description, fontSize = 9.sp, maxLines = 2, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
            Text(if (enabled) "Enabled" else "Disabled", fontSize = 9.sp, color = if (enabled) androidx.compose.ui.graphics.Color.Green else androidx.compose.ui.graphics.Color.Red)
        }
    }
}
