// ============================================================
// Clef Surface Compose Widget — Slider
//
// Range input slider. Renders a Material 3 Slider with an
// optional label and percentage/value readout. Left/right
// dragging adjusts the value within min/max bounds. Maps the
// slider.widget anatomy (root, label, track, range, thumb,
// output) to Compose Slider with Text display.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

// --------------- Component ---------------

@Composable
fun Slider(
    value: Float,
    onValueChange: (Float) -> Unit,
    modifier: Modifier = Modifier,
    min: Float = 0f,
    max: Float = 100f,
    steps: Int = 0,
    label: String? = null,
    enabled: Boolean = true,
    showValue: Boolean = true,
) {
    val ratio = if (max > min) (value - min) / (max - min) else 0f
    val percent = (ratio * 100).roundToInt()

    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            androidx.compose.material3.Slider(
                value = value,
                onValueChange = onValueChange,
                valueRange = min..max,
                steps = steps,
                enabled = enabled,
                modifier = Modifier.weight(1f),
            )

            if (showValue) {
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "$percent%",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
