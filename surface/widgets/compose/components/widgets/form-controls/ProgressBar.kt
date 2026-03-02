// ============================================================
// Clef Surface Compose Widget — ProgressBar
//
// Visual progress indicator. Renders a Material 3
// LinearProgressIndicator with an optional label and
// percentage readout. Maps the progress-bar.widget anatomy
// (root, track, fill, label, valueText) to Compose layout
// with LinearProgressIndicator.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

enum class ProgressBarSize { Sm, Md, Lg }

// --------------- Size Mapping ---------------

private fun ProgressBarSize.trackHeight(): Dp = when (this) {
    ProgressBarSize.Sm -> 4.dp
    ProgressBarSize.Md -> 8.dp
    ProgressBarSize.Lg -> 12.dp
}

// --------------- Component ---------------

@Composable
fun ProgressBar(
    value: Float,
    modifier: Modifier = Modifier,
    max: Float = 100f,
    size: ProgressBarSize = ProgressBarSize.Md,
    label: String? = null,
    showValue: Boolean = true,
    color: Color = MaterialTheme.colorScheme.primary,
    trackColor: Color = MaterialTheme.colorScheme.surfaceVariant,
) {
    val clamped = value.coerceIn(0f, max)
    val progress = if (max > 0f) clamped / max else 0f
    val percent = (progress * 100).toInt()

    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
            Spacer(modifier = Modifier.height(4.dp))
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth(),
        ) {
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .weight(1f)
                    .height(size.trackHeight()),
                color = color,
                trackColor = trackColor,
                strokeCap = StrokeCap.Round,
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
