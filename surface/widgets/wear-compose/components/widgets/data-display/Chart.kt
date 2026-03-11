// ============================================================
// Clef Surface Wear Compose Widget - Chart
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
fun Chart(
    data: List<Float> = emptyList(),
    labels: List<String> = emptyList(),
    modifier: Modifier = Modifier
) {
    val maxVal = data.maxOrNull() ?: 1f
    Row(modifier = modifier.height(60.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.Bottom) {
        data.forEachIndexed { i, value ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Box(modifier = Modifier.width(8.dp).height(((value / maxVal) * 50).dp))
                if (i < labels.size) Text(labels[i], fontSize = 7.sp)
            }
        }
    }
}
