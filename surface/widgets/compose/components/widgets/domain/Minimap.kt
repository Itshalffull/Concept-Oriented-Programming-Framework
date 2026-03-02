// ============================================================
// Clef Surface Compose Widget — Minimap
//
// Scaled-down overview of a larger document or canvas, rendered
// as a small Canvas composable. Uses density shading to represent
// content and highlights the current viewport position within
// the full document.
//
// Adapts the minimap.widget spec: anatomy (root, canvas,
// viewport, zoomControls, zoomIn, zoomOut, zoomFit, zoomLevel),
// states (idle, panning), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private fun computeDensity(line: String): Float {
    val trimmed = line.trim()
    if (trimmed.isEmpty()) return 0f
    return (trimmed.length.toFloat() / line.length.coerceAtLeast(1)).coerceIn(0f, 1f)
}

// --------------- Component ---------------

/**
 * Small Canvas overview minimap of document content.
 *
 * @param content Lines of content to visualize.
 * @param visibleStart First visible line index.
 * @param visibleEnd Last visible line index (exclusive).
 * @param totalLines Total number of lines in the document.
 * @param width Width of the minimap.
 * @param height Height of the minimap.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Minimap(
    content: List<String>,
    visibleStart: Int,
    visibleEnd: Int,
    totalLines: Int,
    width: Dp = 80.dp,
    height: Dp = 120.dp,
    modifier: Modifier = Modifier,
) {
    val densities = remember(content, totalLines, height) {
        if (totalLines == 0) return@remember emptyList<Float>()
        val rowCount = 60 // virtual rows to sample
        val linesPerRow = (totalLines.toFloat() / rowCount).coerceAtLeast(1f)
        (0 until rowCount).map { row ->
            val sampleLine = (row * linesPerRow).toInt().coerceAtMost(content.lastIndex.coerceAtLeast(0))
            computeDensity(content.getOrElse(sampleLine) { "" })
        }
    }

    Column(
        modifier = modifier.padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Canvas(
            modifier = Modifier
                .size(width, height)
                .border(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            if (densities.isEmpty() || totalLines == 0) return@Canvas

            val rowHeight = size.height / densities.size

            // Draw density bars
            densities.forEachIndexed { index, density ->
                if (density > 0f) {
                    val barWidth = size.width * density
                    drawRect(
                        color = Color.Gray.copy(alpha = 0.2f + density * 0.4f),
                        topLeft = Offset(0f, index * rowHeight),
                        size = Size(barWidth, rowHeight),
                    )
                }
            }

            // Draw viewport indicator
            val viewTopRatio = visibleStart.toFloat() / totalLines
            val viewBottomRatio = visibleEnd.toFloat() / totalLines
            val viewTop = viewTopRatio * size.height
            val viewHeight = (viewBottomRatio - viewTopRatio) * size.height

            drawRect(
                color = Color(0xFF6200EE).copy(alpha = 0.3f),
                topLeft = Offset(0f, viewTop),
                size = Size(size.width, viewHeight),
            )
            drawRect(
                color = Color(0xFF6200EE),
                topLeft = Offset(0f, viewTop),
                size = Size(size.width, viewHeight),
                style = Stroke(width = 2f),
            )
        }

        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "${visibleStart + 1}-$visibleEnd/$totalLines",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}
