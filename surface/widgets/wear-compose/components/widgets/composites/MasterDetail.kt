// ============================================================
// Clef Surface Wear Compose Widget - MasterDetail
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
fun MasterDetail(items: List<Pair<String, @Composable () -> Unit>> = emptyList(), modifier: Modifier = Modifier) {
    var selectedIndex by remember { mutableStateOf(-1) }
    if (selectedIndex >= 0 && selectedIndex < items.size) { items[selectedIndex].second() }
    else { ScalingLazyColumn(modifier = modifier) { items(items.size) { i -> Chip(onClick = { selectedIndex = i }, label = { Text(items[i].first, fontSize = 12.sp) }, modifier = Modifier.fillMaxWidth()) } } }
}
