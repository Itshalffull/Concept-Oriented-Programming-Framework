// ============================================================
// Clef Surface Wear Compose Widget - BacklinkPanel
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
fun BacklinkPanel(backlinks: List<Pair<String, String>> = emptyList(), onClick: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Backlinks", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(backlinks.size) { i -> Chip(onClick = { onClick(i) }, label = { Column { Text(backlinks[i].first, fontSize = 11.sp); Text(backlinks[i].second, fontSize = 9.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f)) } }, modifier = Modifier.fillMaxWidth()) }
    }
}
