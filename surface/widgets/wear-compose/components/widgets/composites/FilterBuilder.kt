// ============================================================
// Clef Surface Wear Compose Widget - FilterBuilder
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
fun FilterBuilder(filters: List<Triple<String, String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Filters", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(filters.size) { i -> Card(onClick = {}, modifier = Modifier.fillMaxWidth()) { Text("${filters[i].first} ${filters[i].second} ${filters[i].third}", fontSize = 10.sp) } }
    }
}
