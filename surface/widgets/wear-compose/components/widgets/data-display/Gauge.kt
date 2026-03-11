// ============================================================
// Clef Surface Wear Compose Widget - Gauge
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
fun ClefGauge(
    value: Float = 0f,
    maxValue: Float = 100f,
    label: String = "",
    modifier: Modifier = Modifier
) {
    val progress = if (maxValue > 0f) (value / maxValue).coerceIn(0f, 1f) else 0f
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        CircularProgressIndicator(progress = progress, modifier = Modifier.size(48.dp), strokeWidth = 4.dp)
        Text("${value.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Bold)
        if (label.isNotEmpty()) Text(label, fontSize = 9.sp)
    }
}
