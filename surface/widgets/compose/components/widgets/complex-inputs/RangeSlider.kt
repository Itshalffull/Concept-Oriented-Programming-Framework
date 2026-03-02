// ============================================================
// Clef Surface Compose Widget — RangeSlider
//
// Dual-thumb slider for selecting a numeric range using the
// Material 3 RangeSlider composable. Displays the current
// low..high values and an optional label. The two thumbs are
// constrained so that the low thumb cannot exceed the high thumb.
//
// Adapts the range-slider.widget spec: anatomy (root, label,
// track, range, thumbMin, thumbMax, outputMin, outputMax),
// states (interaction), and connect attributes to Compose
// rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * RangeSlider composable that renders a dual-thumb Material 3
 * RangeSlider for selecting a numeric range.
 *
 * @param min Minimum bound of the slider range.
 * @param max Maximum bound of the slider range.
 * @param low Current lower value.
 * @param high Current upper value.
 * @param steps Number of discrete steps (0 for continuous).
 * @param label Visible label for the slider.
 * @param enabled Whether the slider is enabled.
 * @param onRangeChange Callback when either value changes, receiving (low, high).
 * @param modifier Compose modifier for the root element.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RangeSlider(
    min: Float = 0f,
    max: Float = 100f,
    low: Float? = null,
    high: Float? = null,
    steps: Int = 0,
    label: String? = null,
    enabled: Boolean = true,
    onRangeChange: ((low: Float, high: Float) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var internalLow by remember { mutableFloatStateOf(low ?: min) }
    var internalHigh by remember { mutableFloatStateOf(high ?: max) }

    val currentLow = low ?: internalLow
    val currentHigh = high ?: internalHigh

    LaunchedEffect(low) { if (low != null) internalLow = low }
    LaunchedEffect(high) { if (high != null) internalHigh = high }

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Label --
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )
        }

        // -- RangeSlider --
        RangeSlider(
            value = currentLow..currentHigh,
            onValueChange = { range ->
                internalLow = range.start
                internalHigh = range.endInclusive
                onRangeChange?.invoke(range.start, range.endInclusive)
            },
            valueRange = min..max,
            steps = steps,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Value display --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Min: ${"%.0f".format(currentLow)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )
            Text(
                text = "${"%.0f".format(currentLow)} - ${"%.0f".format(currentHigh)}",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )
            Text(
                text = "Max: ${"%.0f".format(currentHigh)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )
        }
    }
}
