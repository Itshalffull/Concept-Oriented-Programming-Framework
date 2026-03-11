// ============================================================
// Clef Surface Wear Compose Widget - RangeSlider
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
fun RangeSlider(
    lowerValue: Float = 0f,
    upperValue: Float = 100f,
    onLowerChange: (Float) -> Unit = {},
    onUpperChange: (Float) -> Unit = {},
    range: ClosedFloatingPointRange<Float> = 0f..100f,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Text("Min: ${lowerValue.toInt()}", fontSize = 10.sp)
        InlineSlider(value = lowerValue, onValueChange = onLowerChange, valueRange = range, steps = 9, modifier = Modifier.fillMaxWidth())
        Text("Max: ${upperValue.toInt()}", fontSize = 10.sp)
        InlineSlider(value = upperValue, onValueChange = onUpperChange, valueRange = range, steps = 9, modifier = Modifier.fillMaxWidth())
    }
}
