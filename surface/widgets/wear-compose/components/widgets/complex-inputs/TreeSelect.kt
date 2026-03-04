// ============================================================
// Clef Surface Wear Compose Widget - TreeSelect
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.complexinputs

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
fun TreeSelect(
    items: List<Pair<String, String>> = emptyList(),
    selectedValue: String = "",
    onSelect: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(items.size) { i ->
            val (label, value) = items[i]
            Chip(
                onClick = { onSelect(value) },
                label = { Text(label, fontSize = 12.sp) },
                colors = if (value == selectedValue) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
