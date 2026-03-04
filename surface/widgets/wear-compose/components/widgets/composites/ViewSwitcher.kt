// ============================================================
// Clef Surface Wear Compose Widget - ViewSwitcher
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
fun ViewSwitcher(options: List<Pair<String, String>> = emptyList(), selectedId: String = "", onSelect: (String) -> Unit = {}, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEach { (id, label) -> CompactChip(onClick = { onSelect(id) }, label = { Text(label, fontSize = 10.sp) }, colors = if (id == selectedId) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors()) }
    }
}
