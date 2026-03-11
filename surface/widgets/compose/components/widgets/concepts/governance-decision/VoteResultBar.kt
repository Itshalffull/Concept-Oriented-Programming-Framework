package com.clef.surface.widgets.concepts.governancedecision

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class VoteResultBarState { Idle, Animating, SegmentHovered }

sealed class VoteResultBarEvent {
    data class HoverSegment(val index: Int) : VoteResultBarEvent()
    object AnimateIn : VoteResultBarEvent()
    object AnimationEnd : VoteResultBarEvent()
    object Unhover : VoteResultBarEvent()
}

fun voteResultBarReduce(state: VoteResultBarState, event: VoteResultBarEvent): VoteResultBarState = when (state) {
    VoteResultBarState.Idle -> when (event) {
        is VoteResultBarEvent.HoverSegment -> VoteResultBarState.SegmentHovered
        is VoteResultBarEvent.AnimateIn -> VoteResultBarState.Animating
        else -> state
    }
    VoteResultBarState.Animating -> when (event) {
        is VoteResultBarEvent.AnimationEnd -> VoteResultBarState.Idle
        else -> state
    }
    VoteResultBarState.SegmentHovered -> when (event) {
        is VoteResultBarEvent.Unhover -> VoteResultBarState.Idle
        is VoteResultBarEvent.HoverSegment -> VoteResultBarState.SegmentHovered
        else -> state
    }
}

// --- Types ---

data class VoteSegment(
    val label: String,
    val count: Int,
    val color: Color? = null
)

private val DEFAULT_COLORS = listOf(
    Color(0xFF4CAF50), Color(0xFFF44336), Color(0xFFFF9800), Color(0xFF2196F3),
    Color(0xFF9C27B0), Color(0xFF00BCD4), Color(0xFF795548), Color(0xFF607D8B)
)

private fun formatPercent(value: Float): String {
    val formatted = "%.1f".format(value)
    return if (formatted.endsWith(".0")) formatted.dropLast(2) else formatted
}

@Composable
fun VoteResultBar(
    segments: List<VoteSegment>,
    modifier: Modifier = Modifier,
    total: Int? = null,
    variant: String = "binary",
    showLabels: Boolean = true,
    showQuorum: Boolean = false,
    quorumThreshold: Float = 0f,
    animate: Boolean = true,
    size: String = "md",
    onSegmentHover: (Int?, VoteSegment?) -> Unit = { _, _ -> }
) {
    var state by remember { mutableStateOf(VoteResultBarState.Idle) }
    var hoveredIndex by remember { mutableStateOf<Int?>(null) }
    var animated by remember { mutableStateOf(!animate) }

    val resolvedTotal = remember(total, segments) {
        if (total != null && total > 0) total else segments.sumOf { it.count }
    }

    data class ComputedSegment(
        val segment: VoteSegment,
        val percent: Float,
        val resolvedColor: Color
    )

    val computedSegments = remember(segments, resolvedTotal) {
        segments.mapIndexed { i, seg ->
            val percent = if (resolvedTotal > 0) (seg.count.toFloat() / resolvedTotal) * 100f else 0f
            ComputedSegment(seg, percent, seg.color ?: DEFAULT_COLORS[i % DEFAULT_COLORS.size])
        }
    }

    val ariaDescription = remember(computedSegments, resolvedTotal) {
        val parts = computedSegments.joinToString(", ") {
            "${it.segment.label}: ${it.segment.count} votes (${formatPercent(it.percent)}%)"
        }
        "Vote results: $parts. Total: $resolvedTotal votes."
    }

    // Animation on mount
    LaunchedEffect(animate) {
        if (animate) {
            state = voteResultBarReduce(state, VoteResultBarEvent.AnimateIn)
            delay(50) // let compose paint zero widths first
            animated = true
            delay(400)
            state = voteResultBarReduce(state, VoteResultBarEvent.AnimationEnd)
        } else {
            animated = true
        }
    }

    val barHeight = when (size) {
        "sm" -> 16.dp
        "lg" -> 36.dp
        else -> 24.dp
    }
    val labelFontSize = when (size) {
        "sm" -> 11.sp
        "lg" -> 14.sp
        else -> 12.sp
    }

    Column(modifier = modifier.semantics { contentDescription = ariaDescription }) {
        // Bar
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(barHeight)
                .clip(MaterialTheme.shapes.small)
                .background(Color(0xFFE0E0E0))
        ) {
            Row(modifier = Modifier.fillMaxSize()) {
                computedSegments.forEachIndexed { i, seg ->
                    val targetWeight = if (animated) seg.percent.coerceAtLeast(0.1f) else 0.1f
                    val animatedWeight by animateFloatAsState(
                        targetValue = targetWeight,
                        animationSpec = tween(if (animate) 400 else 0),
                        label = "segment-$i"
                    )
                    val isHovered = hoveredIndex == i
                    val alpha = if (hoveredIndex != null && !isHovered) 0.5f else 1f

                    Box(
                        modifier = Modifier
                            .weight(animatedWeight)
                            .fillMaxHeight()
                            .background(seg.resolvedColor.copy(alpha = alpha))
                    )
                }
            }

            // Quorum marker
            if (showQuorum && quorumThreshold > 0f) {
                Box(
                    modifier = Modifier
                        .fillMaxHeight()
                        .width(2.dp)
                        .offset(x = (quorumThreshold / 100f * 300).dp) // approximate
                        .background(Color.Black)
                )
            }
        }

        // Labels
        if (showLabels) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.padding(top = 4.dp).fillMaxWidth()
            ) {
                computedSegments.forEach { seg ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(seg.resolvedColor)
                        )
                        Text(
                            "${seg.segment.label} ${seg.segment.count} (${formatPercent(seg.percent)}%)",
                            fontSize = labelFontSize,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Total
        Text(
            "Total: $resolvedTotal",
            fontSize = labelFontSize,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 4.dp)
        )
    }
}
