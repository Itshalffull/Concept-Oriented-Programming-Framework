// ============================================================
// Clef Surface Wear Compose Widget - FacetedSearch
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
fun FacetedSearch(query: String = "", facets: List<Pair<String, Boolean>> = emptyList(), onQueryChange: (String) -> Unit = {}, onFacetToggle: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        Chip(onClick = {}, label = { Text(query.ifEmpty { "Search..." }, fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            facets.forEachIndexed { i, (label, active) -> CompactChip(onClick = { onFacetToggle(i) }, label = { Text(label, fontSize = 9.sp) }, colors = if (active) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors()) }
        }
    }
}
