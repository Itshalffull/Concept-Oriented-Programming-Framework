// ============================================================
// Clef Surface Wear Compose Widget - Tabs
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.navigation

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
fun Tabs(
    tabs: List<Pair<String, @Composable () -> Unit>> = emptyList(),
    selectedIndex: Int = 0,
    onSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            tabs.forEachIndexed { i, (label, _) ->
                CompactChip(
                    onClick = { onSelect(i) },
                    label = { Text(label, fontSize = 10.sp) },
                    colors = if (i == selectedIndex) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors()
                )
            }
        }
        if (selectedIndex in tabs.indices) { tabs[selectedIndex].second() }
    }
}
