// ============================================================
// Clef Surface Wear Compose Widget - BlockEditor
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.domain

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
fun BlockEditor(blocks: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        items(blocks.size) { i -> Card(onClick = {}, modifier = Modifier.fillMaxWidth()) { Column { Text(blocks[i].first, fontSize = 8.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)); Text(blocks[i].second, fontSize = 10.sp) } } }
    }
}
