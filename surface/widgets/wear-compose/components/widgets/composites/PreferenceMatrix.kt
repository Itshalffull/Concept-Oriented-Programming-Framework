// ============================================================
// Clef Surface Wear Compose Widget - PreferenceMatrix
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
fun PreferenceMatrix(groups: List<Pair<String, List<Pair<String, Boolean>>>> = emptyList(), onToggle: (Int, Int) -> Unit = { _, _ -> }, modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        groups.forEachIndexed { g, (title, items) ->
            item { Text(title, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            items.forEachIndexed { i, (label, enabled) -> item {
                ToggleChip(checked = enabled, onCheckedChange = { onToggle(g, i) }, label = { Text(label, fontSize = 10.sp) }, toggleControl = { ToggleChipDefaults.SwitchIcon(checked = enabled) }, modifier = Modifier.fillMaxWidth())
            } }
        }
    }
}
