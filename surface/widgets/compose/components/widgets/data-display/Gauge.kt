// ============================================================
// Clef Surface Compose Widget — Gauge
//
// Circular or arc-shaped progress indicator displaying a numeric
// score against a defined range. Compose adaptation: Canvas arc
// drawing with background track and foreground sweep, centered
// percentage text, and optional label below.
// See widget spec: repertoire/widgets/data-display/gauge.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.roundToInt

// --------------- Types ---------------

enum class GaugeSize(val diameter: Dp, val strokeWidth: Dp) {
    Sm(diameter = 80.dp, strokeWidth = 8.dp),
    Md(diameter = 120.dp, strokeWidth = 12.dp),
    Lg(diameter = 180.dp, strokeWidth = 16.dp),
}

// --------------- Component ---------------

/**
 * Arc-shaped gauge indicator displaying a value within a range.
 *
 * @param value Current value.
 * @param min Minimum value of the range.
 * @param max Maximum value of the range.
 * @param size Size preset controlling gauge diameter and stroke.
 * @param label Descriptive label for the gauge.
 * @param showValue Whether to show the numeric percentage.
 * @param gaugeColor Override color for the filled arc. Auto-themed if null.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Gauge(
    value: Float,
    min: Float = 0f,
    max: Float = 100f,
    size: GaugeSize = GaugeSize.Md,
    label: String? = null,
    showValue: Boolean = true,
    gaugeColor: Color? = null,
    modifier: Modifier = Modifier,
) {
    val range = (max - min).coerceAtLeast(1f)
    val clamped = value.coerceIn(min, max)
    val percentage = ((clamped - min) / range) * 100f

    val resolvedColor = gaugeColor ?: when {
        percentage >= 80f -> Color(0xFF4CAF50) // green
        percentage >= 50f -> Color(0xFFFFC107) // amber
        percentage >= 25f -> Color(0xFFFF9800) // orange
        else -> Color(0xFFF44336) // red
    }

    val trackColor = MaterialTheme.colorScheme.surfaceVariant

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        // Label above
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        // Arc gauge
        Box(
            modifier = Modifier.size(size.diameter),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(modifier = Modifier.size(size.diameter)) {
                val stroke = size.strokeWidth.toPx()
                val arcSize = Size(
                    this.size.width - stroke,
                    this.size.height - stroke,
                )
                val topLeft = Offset(stroke / 2f, stroke / 2f)

                // Background track (full 270-degree arc)
                drawArc(
                    color = trackColor,
                    startAngle = 135f,
                    sweepAngle = 270f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )

                // Foreground filled arc
                val sweepAngle = (percentage / 100f) * 270f
                drawArc(
                    color = resolvedColor,
                    startAngle = 135f,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = stroke, cap = StrokeCap.Round),
                )
            }

            // Center text
            if (showValue) {
                Text(
                    text = "${percentage.roundToInt()}%",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    textAlign = TextAlign.Center,
                )
            }
        }

        // Value detail below
        if (showValue) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${clamped.roundToInt()} of ${max.roundToInt()}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
