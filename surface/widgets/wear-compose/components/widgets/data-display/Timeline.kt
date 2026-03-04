// ============================================================
// Clef Surface Wear Compose Widget - Timeline
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
fun Timeline(
    entries: List<Pair<String, String>> = emptyList(),
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(entries.size) { i ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(modifier = Modifier.size(8.dp))
                }
                Column {
                    Text(entries[i].first, fontSize = 11.sp, fontWeight = FontWeight.Medium)
                    Text(entries[i].second, fontSize = 9.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
                }
            }
        }
    }
}
