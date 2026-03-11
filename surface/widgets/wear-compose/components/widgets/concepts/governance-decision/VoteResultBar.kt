package com.clef.surface.widgets.concepts.governancedecision

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class VoteResultBarState { Idle, SegmentSelected }

sealed class VoteResultBarEvent {
    data class SelectSegment(val index: Int) : VoteResultBarEvent()
    object Deselect : VoteResultBarEvent()
}

fun voteResultBarReduce(
    state: VoteResultBarState,
    event: VoteResultBarEvent
): VoteResultBarState = when (state) {
    VoteResultBarState.Idle -> when (event) {
        is VoteResultBarEvent.SelectSegment -> VoteResultBarState.SegmentSelected
        else -> state
    }
    VoteResultBarState.SegmentSelected -> when (event) {
        is VoteResultBarEvent.Deselect -> VoteResultBarState.Idle
        is VoteResultBarEvent.SelectSegment -> VoteResultBarState.SegmentSelected
    }
}

// --- Public types ---

data class VoteSegment(
    val label: String,
    val count: Int,
    val color: Color? = null
)

private val DEFAULT_COLORS = listOf(
    Color(0xFF4CAF50), Color(0xFFF44336), Color(0xFFFF9800),
    Color(0xFF2196F3), Color(0xFF9C27B0), Color(0xFF00BCD4)
)

@Composable
fun VoteResultBar(
    segments: List<VoteSegment>,
    modifier: Modifier = Modifier,
    quorum: Int? = null,
    showPercentages: Boolean = true
) {
    var state by remember { mutableStateOf(VoteResultBarState.Idle) }
    var selectedIndex by remember { mutableStateOf<Int?>(null) }
    val listState = rememberScalingLazyListState()

    val total = segments.sumOf { it.count }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Vote results" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Votes: $total",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        quorum?.let { q ->
            item {
                Text(
                    text = if (total >= q) "Quorum met ($q)" else "Quorum: $total/$q",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (total >= q) Color(0xFF22C55E) else Color(0xFFF59E0B)
                )
            }
        }

        // Visual bar representation using colored boxes
        if (total > 0) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .padding(horizontal = 16.dp)
                ) {
                    segments.forEachIndexed { idx, segment ->
                        val color = segment.color ?: DEFAULT_COLORS[idx % DEFAULT_COLORS.size]
                        val weight = segment.count.toFloat() / total
                        Box(
                            modifier = Modifier
                                .weight(weight)
                                .fillMaxHeight()
                                .background(color)
                        )
                    }
                }
            }
        }

        // Segment chips
        val indexedSegments = segments.mapIndexed { idx, seg -> idx to seg }
        items(indexedSegments) { (idx, segment) ->
            val color = segment.color ?: DEFAULT_COLORS[idx % DEFAULT_COLORS.size]
            val percent = if (total > 0) (segment.count.toFloat() / total * 100).toInt() else 0
            val isSelected = selectedIndex == idx

            Chip(
                onClick = {
                    val nextIdx = if (isSelected) null else idx
                    selectedIndex = nextIdx
                    state = voteResultBarReduce(
                        state,
                        if (nextIdx != null) VoteResultBarEvent.SelectSegment(nextIdx)
                        else VoteResultBarEvent.Deselect
                    )
                },
                label = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(color)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "${segment.label}: ${segment.count}",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                },
                secondaryLabel = if (showPercentages) {
                    { Text("$percent%", style = MaterialTheme.typography.labelSmall) }
                } else null
            )
        }
    }
}
