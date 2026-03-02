// ============================================================
// Clef Surface Compose Widget — CanvasConnector
//
// Edge or arrow connecting two canvas nodes. Draws a line between
// two offset positions on a Canvas composable with an optional
// label rendered at the midpoint.
//
// Adapts the canvas-connector.widget spec: anatomy (root, path,
// startHandle, endHandle, label), states (idle, hovered,
// selected, draggingStart, draggingEnd, editingLabel, deleted),
// and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Edge connecting two canvas nodes via a drawn line with optional label.
 *
 * @param fromOffset Starting point of the connector in pixels.
 * @param toOffset Ending point of the connector in pixels.
 * @param label Optional label displayed at the midpoint.
 * @param color Color of the connector line.
 * @param strokeWidth Width of the connector line in dp.
 * @param modifier Modifier for the root Canvas.
 */
@Composable
fun CanvasConnector(
    fromOffset: Offset,
    toOffset: Offset,
    label: String? = null,
    color: Color = Color.Gray,
    strokeWidth: Float = 2f,
    modifier: Modifier = Modifier,
) {
    val density = LocalDensity.current

    Box(modifier = modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            // Draw connector line
            drawLine(
                color = color,
                start = fromOffset,
                end = toOffset,
                strokeWidth = strokeWidth,
                cap = StrokeCap.Round,
            )

            // Draw arrowhead at the end
            val angle = kotlin.math.atan2(
                (toOffset.y - fromOffset.y).toDouble(),
                (toOffset.x - fromOffset.x).toDouble(),
            )
            val arrowLen = 12f
            val arrowAngle = Math.toRadians(25.0)

            val x1 = toOffset.x - arrowLen * kotlin.math.cos(angle - arrowAngle).toFloat()
            val y1 = toOffset.y - arrowLen * kotlin.math.sin(angle - arrowAngle).toFloat()
            val x2 = toOffset.x - arrowLen * kotlin.math.cos(angle + arrowAngle).toFloat()
            val y2 = toOffset.y - arrowLen * kotlin.math.sin(angle + arrowAngle).toFloat()

            drawLine(color = color, start = toOffset, end = Offset(x1, y1), strokeWidth = strokeWidth)
            drawLine(color = color, start = toOffset, end = Offset(x2, y2), strokeWidth = strokeWidth)
        }

        // Midpoint label
        if (label != null) {
            val mid = Offset(
                (fromOffset.x + toOffset.x) / 2f,
                (fromOffset.y + toOffset.y) / 2f,
            )
            Text(
                text = label,
                modifier = Modifier.offset {
                    IntOffset(mid.x.toInt(), mid.y.toInt() - with(density) { 8.dp.roundToPx() })
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
