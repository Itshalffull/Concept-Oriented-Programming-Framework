// ============================================================
// Clef Surface Wear Compose Widget - ColorLabelPicker
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.domain

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
fun ColorLabelPicker(colors: List<Pair<String, Long>> = emptyList(), selectedName: String = "", onSelect: (String) -> Unit = {}, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        colors.forEach { (name, color) -> CompactChip(onClick = { onSelect(name) }, label = { Text(if (name == selectedName) "✓" else " ") }, colors = ChipDefaults.chipColors(backgroundColor = androidx.compose.ui.graphics.Color(color))) }
    }
}
