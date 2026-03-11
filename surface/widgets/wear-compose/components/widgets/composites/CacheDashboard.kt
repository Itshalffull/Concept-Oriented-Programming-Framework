// ============================================================
// Clef Surface Wear Compose Widget - CacheDashboard
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
fun CacheDashboard(totalSize: String = "0 KB", hitRate: Float = 0f, entries: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Size: $totalSize", fontSize = 10.sp); Text("Hit: ${(hitRate * 100).toInt()}%", fontSize = 10.sp) } }
        item { CircularProgressIndicator(progress = hitRate, modifier = Modifier.size(32.dp)) }
        items(entries.size) { i -> Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(entries[i].first, fontSize = 9.sp); Text(entries[i].second, fontSize = 9.sp) } }
    }
}
