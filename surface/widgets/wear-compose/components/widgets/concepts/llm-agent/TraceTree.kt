package com.clef.surface.widgets.concepts.llmagent

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

enum class TraceTreeState { Idle, SpanSelected }

sealed class TraceTreeEvent {
    data class SelectSpan(val spanId: String) : TraceTreeEvent()
    object Deselect : TraceTreeEvent()
}

fun traceTreeReduce(
    state: TraceTreeState,
    event: TraceTreeEvent
): TraceTreeState = when (state) {
    TraceTreeState.Idle -> when (event) {
        is TraceTreeEvent.SelectSpan -> TraceTreeState.SpanSelected
        else -> state
    }
    TraceTreeState.SpanSelected -> when (event) {
        is TraceTreeEvent.Deselect -> TraceTreeState.Idle
        is TraceTreeEvent.SelectSpan -> TraceTreeState.SpanSelected
    }
}

// --- Public types ---

data class TraceSpan(
    val id: String,
    val parentId: String? = null,
    val label: String,
    val durationMs: Long? = null,
    val status: String = "ok",
    val children: List<TraceSpan> = emptyList()
)

private fun flattenSpans(spans: List<TraceSpan>, depth: Int = 0): List<Pair<Int, TraceSpan>> {
    val result = mutableListOf<Pair<Int, TraceSpan>>()
    for (span in spans) {
        result.add(depth to span)
        result.addAll(flattenSpans(span.children, depth + 1))
    }
    return result
}

@Composable
fun TraceTree(
    spans: List<TraceSpan>,
    modifier: Modifier = Modifier,
    onSelectSpan: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(TraceTreeState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val flatList = remember(spans) { flattenSpans(spans) }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Trace tree" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Traces (${flatList.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(flatList) { (depth, span) ->
            val isSelected = selectedId == span.id
            val statusColor = when (span.status) {
                "error" -> Color(0xFFEF4444)
                "ok" -> Color(0xFF22C55E)
                else -> MaterialTheme.colorScheme.onSurface
            }

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else span.id
                    selectedId = nextId
                    state = traceTreeReduce(
                        state,
                        if (nextId != null) TraceTreeEvent.SelectSpan(nextId)
                        else TraceTreeEvent.Deselect
                    )
                    if (nextId != null) onSelectSpan(nextId)
                },
                label = {
                    Text(
                        text = span.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = statusColor
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text("Status: ${span.status}", style = MaterialTheme.typography.labelSmall)
                            span.durationMs?.let {
                                Text("${it}ms", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                } else {
                    span.durationMs?.let {
                        { Text("${it}ms", style = MaterialTheme.typography.labelSmall) }
                    }
                },
                modifier = Modifier.padding(start = (depth * 12).dp)
            )
        }
    }
}
