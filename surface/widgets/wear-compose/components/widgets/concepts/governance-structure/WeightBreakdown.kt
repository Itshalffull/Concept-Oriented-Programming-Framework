package com.clef.surface.widgets.concepts.governancestructure

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

enum class WeightBreakdownState { Idle, SegmentSelected }

sealed class WeightBreakdownEvent {
    data class SelectSegment(val label: String) : WeightBreakdownEvent()
    object Deselect : WeightBreakdownEvent()
}

fun weightBreakdownReduce(
    state: WeightBreakdownState,
    event: WeightBreakdownEvent
): WeightBreakdownState = when (state) {
    WeightBreakdownState.Idle -> when (event) {
        is WeightBreakdownEvent.SelectSegment -> WeightBreakdownState.SegmentSelected
        else -> state
    }
    WeightBreakdownState.SegmentSelected -> when (event) {
        is WeightBreakdownEvent.Deselect -> WeightBreakdownState.Idle
        is WeightBreakdownEvent.SelectSegment -> WeightBreakdownState.SegmentSelected
    }
}

// --- Public types ---

enum class WeightSourceType { Token, Delegation, Reputation, Manual }

data class WeightSource(
    val label: String,
    val value: Float,
    val sourceType: WeightSourceType,
    val color: Color? = null
)

private val TYPE_COLORS = mapOf(
    WeightSourceType.Token to Color(0xFF3B82F6),
    WeightSourceType.Delegation to Color(0xFF8B5CF6),
    WeightSourceType.Reputation to Color(0xFF22C55E),
    WeightSourceType.Manual to Color(0xFFF59E0B)
)

@Composable
fun WeightBreakdown(
    sources: List<WeightSource>,
    totalWeight: Float,
    modifier: Modifier = Modifier,
    voterLabel: String? = null
) {
    var state by remember { mutableStateOf(WeightBreakdownState.Idle) }
    var selectedLabel by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Weight breakdown" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Weight: $totalWeight",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        voterLabel?.let {
            item {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Visual bar
        if (totalWeight > 0) {
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .padding(horizontal = 16.dp)
                ) {
                    sources.forEach { source ->
                        val color = source.color ?: TYPE_COLORS[source.sourceType] ?: Color.Gray
                        val weight = source.value / totalWeight
                        Box(
                            modifier = Modifier
                                .weight(weight.coerceAtLeast(0.01f))
                                .fillMaxHeight()
                                .background(color)
                        )
                    }
                }
            }
        }

        items(sources) { source ->
            val color = source.color ?: TYPE_COLORS[source.sourceType] ?: Color.Gray
            val percent = if (totalWeight > 0) (source.value / totalWeight * 100).toInt() else 0
            val isSelected = selectedLabel == source.label

            Chip(
                onClick = {
                    val next = if (isSelected) null else source.label
                    selectedLabel = next
                    state = weightBreakdownReduce(
                        state,
                        if (next != null) WeightBreakdownEvent.SelectSegment(next)
                        else WeightBreakdownEvent.Deselect
                    )
                },
                label = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).background(color))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "${source.label}: ${source.value}",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                },
                secondaryLabel = {
                    Text("$percent% (${source.sourceType.name})", style = MaterialTheme.typography.labelSmall)
                }
            )
        }
    }
}
