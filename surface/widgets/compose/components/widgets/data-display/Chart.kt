// ============================================================
// Clef Surface Compose Widget — Chart
//
// Data visualisation container rendering bar, line, and pie
// charts. Compose adaptation: uses Canvas for drawing bar
// rectangles, line paths with circles at data points, and
// arc segments for pie slices. Supports title and color theming.
// See widget spec: repertoire/widgets/data-display/chart.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ChartDataPoint(
    val label: String,
    val value: Float,
)

enum class ChartType {
    Bar,
    Line,
    Pie,
}

// --------------- Palette ---------------

private val CHART_COLORS = listOf(
    Color(0xFF6200EE),
    Color(0xFF03DAC5),
    Color(0xFFFF6D00),
    Color(0xFFE91E63),
    Color(0xFF4CAF50),
    Color(0xFFFFEB3B),
    Color(0xFF2196F3),
)

// --------------- Component ---------------

/**
 * Data visualisation widget supporting bar, line, and pie chart types.
 *
 * @param type Chart type to render.
 * @param data Data points to display.
 * @param chartHeight Height of the canvas drawing area.
 * @param title Optional title displayed above the chart.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Chart(
    type: ChartType,
    data: List<ChartDataPoint>,
    chartHeight: Dp = 200.dp,
    title: String? = null,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (title != null) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))
        }

        if (data.isEmpty()) {
            Text(
                text = "No data",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            return@Column
        }

        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(chartHeight)
                .padding(horizontal = 4.dp),
        ) {
            when (type) {
                ChartType.Bar -> drawBarChart(data)
                ChartType.Line -> drawLineChart(data)
                ChartType.Pie -> drawPieChart(data)
            }
        }

        // Labels row for bar/line charts
        if (type != ChartType.Pie) {
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}

// --------------- Drawing helpers ---------------

private fun DrawScope.drawBarChart(data: List<ChartDataPoint>) {
    val maxValue = data.maxOf { it.value }.coerceAtLeast(1f)
    val barWidth = size.width / (data.size * 2f)
    val spacing = barWidth

    data.forEachIndexed { index, point ->
        val barHeight = (point.value / maxValue) * size.height * 0.9f
        val x = index * (barWidth + spacing) + spacing / 2f
        val y = size.height - barHeight

        drawRect(
            color = CHART_COLORS[index % CHART_COLORS.size],
            topLeft = Offset(x, y),
            size = Size(barWidth, barHeight),
        )
    }
}

private fun DrawScope.drawLineChart(data: List<ChartDataPoint>) {
    val maxValue = data.maxOf { it.value }.coerceAtLeast(1f)
    val minValue = data.minOf { it.value }
    val range = (maxValue - minValue).coerceAtLeast(1f)
    val stepX = size.width / (data.size - 1).coerceAtLeast(1)

    val points = data.mapIndexed { index, point ->
        val x = index * stepX
        val y = size.height - ((point.value - minValue) / range) * size.height * 0.9f
        Offset(x, y)
    }

    // Draw line path
    if (points.size >= 2) {
        val path = Path().apply {
            moveTo(points.first().x, points.first().y)
            for (i in 1 until points.size) {
                lineTo(points[i].x, points[i].y)
            }
        }
        drawPath(
            path = path,
            color = CHART_COLORS[0],
            style = Stroke(width = 3f),
        )
    }

    // Draw data point circles
    points.forEach { point ->
        drawCircle(
            color = CHART_COLORS[0],
            radius = 5f,
            center = point,
        )
    }
}

private fun DrawScope.drawPieChart(data: List<ChartDataPoint>) {
    val total = data.sumOf { it.value.toDouble() }.toFloat().coerceAtLeast(1f)
    val diameter = minOf(size.width, size.height) * 0.9f
    val topLeft = Offset(
        (size.width - diameter) / 2f,
        (size.height - diameter) / 2f,
    )
    val arcSize = Size(diameter, diameter)

    var startAngle = -90f
    data.forEachIndexed { index, point ->
        val sweep = (point.value / total) * 360f
        drawArc(
            color = CHART_COLORS[index % CHART_COLORS.size],
            startAngle = startAngle,
            sweepAngle = sweep,
            useCenter = true,
            topLeft = topLeft,
            size = arcSize,
        )
        startAngle += sweep
    }
}
