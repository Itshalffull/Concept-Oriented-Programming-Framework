// ============================================================
// Clef Surface Wear Compose Widget - ViewToggle
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.datadisplay

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
fun ViewToggle(
    modes: List<String> = listOf("list", "grid"),
    selectedMode: String = "list",
    onModeChange: (String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        modes.forEach { mode ->
            CompactChip(
                onClick = { onModeChange(mode) },
                label = { Text(mode, fontSize = 10.sp) },
                colors = if (mode == selectedMode) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors()
            )
        }
    }
}
