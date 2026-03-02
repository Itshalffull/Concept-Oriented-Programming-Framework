// ============================================================
// Clef Surface Compose Widget — Canvas
//
// Infinite two-dimensional spatial plane for placing and
// manipulating visual elements. Uses a Compose Canvas composable
// for drawing a grid background with coordinate/zoom indicators
// and renders child content overlaid on the canvas region.
//
// Adapts the canvas.widget spec: anatomy (root, viewport, grid,
// nodeLayer, edgeLayer, selectionBox, toolbar, minimap,
// propertyPanel), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Infinite two-dimensional spatial canvas with grid background.
 *
 * @param width Width of the canvas area.
 * @param height Height of the canvas area.
 * @param zoom Current zoom level (1.0 = 100%).
 * @param panX Horizontal pan offset.
 * @param panY Vertical pan offset.
 * @param gridSize Size of grid cells in dp.
 * @param gridColor Color for the background grid lines.
 * @param content Child composables rendered on top of the canvas.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ClefCanvas(
    width: Dp = 400.dp,
    height: Dp = 300.dp,
    zoom: Float = 1.0f,
    panX: Float = 0f,
    panY: Float = 0f,
    gridSize: Dp = 24.dp,
    gridColor: Color = Color.LightGray.copy(alpha = 0.3f),
    content: @Composable () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val zoomPercent = (zoom * 100).toInt()

    Column(modifier = modifier.padding(8.dp)) {
        // Header bar
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Canvas",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "  zoom:${zoomPercent}%  pan:(${panX.toInt()},${panY.toInt()})",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Canvas area
        Box(
            modifier = Modifier
                .size(width, height)
                .border(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            // Grid background
            Canvas(modifier = Modifier.fillMaxSize()) {
                val gridPx = gridSize.toPx() * zoom
                if (gridPx > 4f) {
                    val dashEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 4f))
                    // Vertical lines
                    var x = (panX % gridPx + gridPx) % gridPx
                    while (x < size.width) {
                        drawLine(
                            color = gridColor,
                            start = Offset(x, 0f),
                            end = Offset(x, size.height),
                            pathEffect = dashEffect,
                        )
                        x += gridPx
                    }
                    // Horizontal lines
                    var y = (panY % gridPx + gridPx) % gridPx
                    while (y < size.height) {
                        drawLine(
                            color = gridColor,
                            start = Offset(0f, y),
                            end = Offset(size.width, y),
                            pathEffect = dashEffect,
                        )
                        y += gridPx
                    }
                }
            }

            // Overlay content
            content()
        }

        // Coordinate display
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "origin: (${panX.toInt()},${panY.toInt()}) | ${zoomPercent}%",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
