package com.clef.surface.widgets.concepts.llmsafety

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

enum class ExecutionMetricsPanelState { Idle, Updating }

sealed class ExecutionMetricsPanelEvent {
    object Update : ExecutionMetricsPanelEvent()
    object UpdateComplete : ExecutionMetricsPanelEvent()
}

fun executionMetricsPanelReduce(
    state: ExecutionMetricsPanelState,
    event: ExecutionMetricsPanelEvent
): ExecutionMetricsPanelState = when (state) {
    ExecutionMetricsPanelState.Idle -> when (event) {
        is ExecutionMetricsPanelEvent.Update -> ExecutionMetricsPanelState.Updating
        else -> state
    }
    ExecutionMetricsPanelState.Updating -> when (event) {
        is ExecutionMetricsPanelEvent.UpdateComplete -> ExecutionMetricsPanelState.Idle
        else -> state
    }
}

// --- Public types ---

data class ExecutionMetric(
    val label: String,
    val value: String,
    val unit: String? = null,
    val trend: String? = null // "up", "down", "stable"
)

@Composable
fun ExecutionMetricsPanel(
    metrics: List<ExecutionMetric>,
    modifier: Modifier = Modifier,
    title: String = "Metrics"
) {
    var state by remember { mutableStateOf(ExecutionMetricsPanelState.Idle) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Execution metrics" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(title, style = MaterialTheme.typography.titleSmall)
            }
        }

        items(metrics) { metric ->
            val trendIcon = when (metric.trend) {
                "up" -> "\u2191"
                "down" -> "\u2193"
                "stable" -> "\u2192"
                else -> ""
            }
            val trendColor = when (metric.trend) {
                "up" -> Color(0xFFEF4444)
                "down" -> Color(0xFF22C55E)
                else -> MaterialTheme.colorScheme.onSurface
            }

            Chip(
                onClick = {},
                label = {
                    Text(
                        text = metric.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                secondaryLabel = {
                    val unitLabel = metric.unit?.let { " $it" } ?: ""
                    Text(
                        text = "$trendIcon ${metric.value}$unitLabel",
                        style = MaterialTheme.typography.labelSmall,
                        color = trendColor
                    )
                }
            )
        }
    }
}
