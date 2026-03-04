// ============================================================
// Clef Surface Wear Compose Widget - CardGrid
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
fun CardGrid(
    items: List<Pair<String, String>> = emptyList(),
    onSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(items.size) { i ->
            Card(onClick = { onSelect(i) }, modifier = Modifier.fillMaxWidth()) {
                Column {
                    Text(items[i].first, fontSize = 12.sp, fontWeight = FontWeight.Medium)
                    Text(items[i].second, fontSize = 10.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
                }
            }
        }
    }
}
