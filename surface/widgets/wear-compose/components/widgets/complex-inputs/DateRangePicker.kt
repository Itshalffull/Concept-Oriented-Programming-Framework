// ============================================================
// Clef Surface Wear Compose Widget - DateRangePicker
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
fun DateRangePicker(
    startLabel: String = "Start",
    endLabel: String = "End",
    startValue: String = "",
    endValue: String = "",
    onStartClick: () -> Unit = {},
    onEndClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Chip(onClick = onStartClick, label = { Text("$startLabel: $startValue", fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth())
        Chip(onClick = onEndClick, label = { Text("$endLabel: $endValue", fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth())
    }
}
