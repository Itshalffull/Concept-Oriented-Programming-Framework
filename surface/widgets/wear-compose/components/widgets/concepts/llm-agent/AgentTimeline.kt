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

enum class AgentTimelineState { Idle, EntrySelected, Active }

sealed class AgentTimelineEvent {
    data class SelectEntry(val entryId: String) : AgentTimelineEvent()
    object Deselect : AgentTimelineEvent()
    object Activate : AgentTimelineEvent()
}

fun agentTimelineReduce(
    state: AgentTimelineState,
    event: AgentTimelineEvent
): AgentTimelineState = when (state) {
    AgentTimelineState.Idle -> when (event) {
        is AgentTimelineEvent.SelectEntry -> AgentTimelineState.EntrySelected
        is AgentTimelineEvent.Activate -> AgentTimelineState.Active
        else -> state
    }
    AgentTimelineState.EntrySelected -> when (event) {
        is AgentTimelineEvent.Deselect -> AgentTimelineState.Idle
        is AgentTimelineEvent.SelectEntry -> AgentTimelineState.EntrySelected
        else -> state
    }
    AgentTimelineState.Active -> when (event) {
        is AgentTimelineEvent.SelectEntry -> AgentTimelineState.EntrySelected
        else -> state
    }
}

// --- Public types ---

enum class EntryType { Thought, ToolCall, ToolResult, Response, Error }

data class TimelineEntry(
    val id: String,
    val type: EntryType,
    val label: String,
    val timestamp: String? = null,
    val durationMs: Long? = null,
    val status: String = "complete"
)

private val TYPE_ICONS = mapOf(
    EntryType.Thought to "\uD83D\uDCAD",
    EntryType.ToolCall to "\uD83D\uDD27",
    EntryType.ToolResult to "\u2190",
    EntryType.Response to "\uD83D\uDCAC",
    EntryType.Error to "\u26A0"
)

private val TYPE_COLORS = mapOf(
    EntryType.Thought to Color(0xFF8B5CF6),
    EntryType.ToolCall to Color(0xFF3B82F6),
    EntryType.ToolResult to Color(0xFF10B981),
    EntryType.Response to Color(0xFF6366F1),
    EntryType.Error to Color(0xFFEF4444)
)

@Composable
fun AgentTimeline(
    entries: List<TimelineEntry>,
    modifier: Modifier = Modifier,
    agentStatus: String = "idle",
    onSelectEntry: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(AgentTimelineState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Agent timeline" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Agent (${entries.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                agentStatus.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = if (agentStatus == "active") Color(0xFF22C55E) else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        items(entries) { entry ->
            val icon = TYPE_ICONS[entry.type] ?: ""
            val color = TYPE_COLORS[entry.type] ?: Color.Gray
            val isSelected = selectedId == entry.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else entry.id
                    selectedId = nextId
                    state = agentTimelineReduce(
                        state,
                        if (nextId != null) AgentTimelineEvent.SelectEntry(nextId)
                        else AgentTimelineEvent.Deselect
                    )
                    if (nextId != null) onSelectEntry(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${entry.label}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text(entry.type.name, style = MaterialTheme.typography.labelSmall)
                            entry.durationMs?.let { Text("${it}ms", style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                } else null
            )
        }
    }
}
