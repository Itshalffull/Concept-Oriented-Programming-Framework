// ============================================================
// Clef Surface Wear Compose Widget - SortBuilder
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
fun SortBuilder(criteria: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Text("Sort", fontSize = 12.sp, fontWeight = FontWeight.Bold)
        criteria.forEach { (field, dir) -> Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) { Text(field, fontSize = 10.sp); Text(if (dir == "asc") "↑" else "↓", fontSize = 10.sp) } }
    }
}
