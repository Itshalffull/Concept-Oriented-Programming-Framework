// ============================================================
// Clef Surface Wear Compose Widget - ColorPicker
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
fun ColorPicker(
    label: String = "Color",
    colors: List<Long> = listOf(0xFFFF0000, 0xFF00FF00, 0xFF0000FF, 0xFFFFFF00),
    selectedIndex: Int = 0,
    onSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text(label, fontSize = 10.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            colors.forEachIndexed { i, c ->
                CompactChip(
                    onClick = { onSelect(i) },
                    label = { Text(" ") },
                    colors = ChipDefaults.chipColors(backgroundColor = androidx.compose.ui.graphics.Color(c))
                )
            }
        }
    }
}
