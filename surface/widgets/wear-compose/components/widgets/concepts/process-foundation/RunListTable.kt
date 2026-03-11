package com.clef.surface.widgets.concepts.processfoundation

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

enum class RunListTableState { Idle, RowSelected }

sealed class RunListTableEvent {
    data class SelectRow(val runId: String) : RunListTableEvent()
    object Deselect : RunListTableEvent()
}

fun runListTableReduce(
    state: RunListTableState,
    event: RunListTableEvent
): RunListTableState = when (state) {
    RunListTableState.Idle -> when (event) {
        is RunListTableEvent.SelectRow -> RunListTableState.RowSelected
        else -> state
    }
    RunListTableState.RowSelected -> when (event) {
        is RunListTableEvent.Deselect -> RunListTableState.Idle
        is RunListTableEvent.SelectRow -> RunListTableState.RowSelected
    }
}

// --- Public types ---

data class ProcessRun(
    val id: String,
    val name: String,
    val status: String, // running, completed, failed, cancelled, pending
    val startedAt: String? = null,
    val duration: String? = null,
    val triggeredBy: String? = null
)

private val STATUS_ICONS = mapOf(
    "running" to "\u25B6",
    "completed" to "\u2713",
    "failed" to "\u2717",
    "cancelled" to "\u2298",
    "pending" to "\u25CB"
)

private val STATUS_COLORS = mapOf(
    "running" to Color(0xFF3B82F6),
    "completed" to Color(0xFF22C55E),
    "failed" to Color(0xFFEF4444),
    "cancelled" to Color(0xFF6B7280),
    "pending" to Color(0xFF9CA3AF)
)

@Composable
fun RunListTable(
    runs: List<ProcessRun>,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(RunListTableState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val running = runs.count { it.status == "running" }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Run list" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Runs (${runs.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (running > 0) {
            item {
                Text(
                    "$running running",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF3B82F6)
                )
            }
        }

        items(runs) { run ->
            val icon = STATUS_ICONS[run.status] ?: "\u25CB"
            val color = STATUS_COLORS[run.status] ?: Color.Gray
            val isSelected = selectedId == run.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else run.id
                    selectedId = nextId
                    state = runListTableReduce(
                        state,
                        if (nextId != null) RunListTableEvent.SelectRow(nextId)
                        else RunListTableEvent.Deselect
                    )
                    if (nextId != null) onSelect(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${run.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            run.duration?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                            run.triggeredBy?.let { Text("By: $it", style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                } else {
                    run.duration?.let {
                        { Text(it, style = MaterialTheme.typography.labelSmall) }
                    }
                }
            )
        }
    }
}
