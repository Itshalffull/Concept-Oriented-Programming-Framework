package com.clef.surface.widgets.concepts.governancestructure

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class WeightBreakdownState { Idle, SegmentHovered }

sealed class WeightBreakdownEvent {
    data class HoverSegment(val index: Int) : WeightBreakdownEvent()
    object Unhover : WeightBreakdownEvent()
}

fun weightBreakdownReduce(state: WeightBreakdownState, event: WeightBreakdownEvent): WeightBreakdownState = when (state) {
    WeightBreakdownState.Idle -> when (event) {
        is WeightBreakdownEvent.HoverSegment -> WeightBreakdownState.SegmentHovered
        else -> state
    }
    WeightBreakdownState.SegmentHovered -> when (event) {
        is WeightBreakdownEvent.Unhover -> WeightBreakdownState.Idle
        is WeightBreakdownEvent.HoverSegment -> WeightBreakdownState.SegmentHovered
        else -> state
    }
}

// --- Types ---

data class WeightSource(
    val label: String,
    val weight: Float,
    val type: String? = null
)

private val DEFAULT_COLORS = listOf(
    Color(0xFF4CAF50), Color(0xFF2196F3), Color(0xFFFF9800), Color(0xFF9C27B0),
    Color(0xFFF44336), Color(0xFF00BCD4), Color(0xFF795548), Color(0xFF607D8B)
)

private fun formatPercent(value: Float): String {
    val formatted = "%.1f".format(value)
    return if (formatted.endsWith(".0")) formatted.dropLast(2) else formatted
}

@Composable
fun WeightBreakdown(
    sources: List<WeightSource>,
    modifier: Modifier = Modifier,
    variant: String = "bar",
    totalWeight: Float? = null,
    onSegmentHover: (Int?, WeightSource?) -> Unit = { _, _ -> }
) {
    var state by remember { mutableStateOf(WeightBreakdownState.Idle) }
    var hoveredIndex by remember { mutableStateOf<Int?>(null) }

    val resolvedTotal = remember(totalWeight, sources) {
        totalWeight ?: sources.sumOf { it.weight.toDouble() }.toFloat()
    }

    data class ComputedSource(val source: WeightSource, val percent: Float, val color: Color)

    val computed = remember(sources, resolvedTotal) {
        sources.mapIndexed { i, s ->
            val pct = if (resolvedTotal > 0) (s.weight / resolvedTotal) * 100f else 0f
            ComputedSource(s, pct, DEFAULT_COLORS[i % DEFAULT_COLORS.size])
        }
    }

    val ariaDescription = remember(computed, resolvedTotal) {
        computed.joinToString(", ") { "${it.source.label}: ${formatPercent(it.percent)}%" } +
            ". Total: $resolvedTotal"
    }

    Column(modifier = modifier.semantics { contentDescription = "Weight breakdown: $ariaDescription" }) {
        if (variant == "donut") {
            // Donut chart
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(160.dp).align(Alignment.CenterHorizontally)
            ) {
                Canvas(modifier = Modifier.fillMaxSize().padding(8.dp)) {
                    var startAngle = -90f
                    computed.forEach { seg ->
                        val sweep = (seg.percent / 100f) * 360f
                        drawArc(
                            color = seg.color,
                            startAngle = startAngle,
                            sweepAngle = sweep,
                            useCenter = false,
                            topLeft = Offset.Zero,
                            size = Size(size.width, size.height),
                            style = Stroke(width = 24f)
                        )
                        startAngle += sweep
                    }
                }
                Text("${resolvedTotal.toInt()}", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            }
        } else {
            // Bar chart
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(24.dp)
                    .clip(MaterialTheme.shapes.small)
                    .background(Color(0xFFE0E0E0))
            ) {
                computed.forEach { seg ->
                    Box(
                        modifier = Modifier
                            .weight(seg.percent.coerceAtLeast(0.1f))
                            .fillMaxHeight()
                            .background(seg.color)
                    )
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        // Legend
        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 8.dp)
        ) {
            computed.forEachIndexed { i, seg ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier.size(10.dp).clip(CircleShape).background(seg.color)
                    )
                    Text(seg.source.label, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    Text("${formatPercent(seg.percent)}%", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${seg.source.weight}", fontSize = 12.sp, color = MaterialTheme.colorScheme.outline)
                }
            }
        }

        // Total
        Text(
            "Total: $resolvedTotal",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(start = 8.dp, top = 8.dp)
        )
    }
}
