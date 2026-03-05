package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

// --- State machine ---

enum class AgentTimelineState { Idle, EntrySelected, Interrupted, Inactive, Active }

sealed class AgentTimelineEvent {
    object NewEntry : AgentTimelineEvent()
    data class SelectEntry(val id: String?) : AgentTimelineEvent()
    object Interrupt : AgentTimelineEvent()
    object Deselect : AgentTimelineEvent()
    object Resume : AgentTimelineEvent()
    object StreamStart : AgentTimelineEvent()
    object StreamEnd : AgentTimelineEvent()
}

fun agentTimelineReduce(state: AgentTimelineState, event: AgentTimelineEvent): AgentTimelineState = when (state) {
    AgentTimelineState.Idle -> when (event) {
        is AgentTimelineEvent.NewEntry -> AgentTimelineState.Idle
        is AgentTimelineEvent.SelectEntry -> AgentTimelineState.EntrySelected
        is AgentTimelineEvent.Interrupt -> AgentTimelineState.Interrupted
        else -> state
    }
    AgentTimelineState.EntrySelected -> when (event) {
        is AgentTimelineEvent.Deselect -> AgentTimelineState.Idle
        is AgentTimelineEvent.SelectEntry -> AgentTimelineState.EntrySelected
        else -> state
    }
    AgentTimelineState.Interrupted -> when (event) {
        is AgentTimelineEvent.Resume -> AgentTimelineState.Idle
        else -> state
    }
    AgentTimelineState.Inactive -> when (event) {
        is AgentTimelineEvent.StreamStart -> AgentTimelineState.Active
        else -> state
    }
    AgentTimelineState.Active -> when (event) {
        is AgentTimelineEvent.StreamEnd -> AgentTimelineState.Inactive
        else -> state
    }
}

// --- Types ---

enum class EntryType(val icon: String, val label: String) {
    Thought("\u2022\u2022\u2022", "Thought"),
    ToolCall("\u2699", "Tool Call"),
    ToolResult("\u2611", "Tool Result"),
    Response("\u25B6", "Response"),
    Error("\u2717", "Error")
}

enum class EntryStatus { Running, Complete, Error }

data class TimelineEntry(
    val id: String,
    val type: EntryType,
    val label: String,
    val timestamp: String,
    val duration: Long? = null,
    val detail: String? = null,
    val status: EntryStatus? = null
)

private fun formatDuration(ms: Long): String =
    if (ms < 1000) "${ms}ms" else "${"%.1f".format(ms / 1000.0)}s"

@Composable
fun AgentTimeline(
    entries: List<TimelineEntry>,
    agentName: String,
    status: String,
    modifier: Modifier = Modifier,
    showDelegations: Boolean = true,
    autoScroll: Boolean = true,
    maxEntries: Int = 100,
    onInterrupt: () -> Unit = {}
) {
    var state by remember { mutableStateOf(AgentTimelineState.Idle) }
    var selectedEntryId by remember { mutableStateOf<String?>(null) }
    var expandedIds by remember { mutableStateOf(emptySet<String>()) }
    var typeFilter by remember { mutableStateOf<EntryType?>(null) }

    val visibleEntries = remember(entries, maxEntries, typeFilter) {
        val limited = entries.takeLast(maxEntries)
        if (typeFilter != null) limited.filter { it.type == typeFilter } else limited
    }

    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    // Auto-scroll
    LaunchedEffect(entries.size) {
        if (autoScroll && visibleEntries.isNotEmpty()) {
            scope.launch { listState.animateScrollToItem(visibleEntries.size - 1) }
        }
    }

    Column(modifier = modifier.semantics { contentDescription = "Agent timeline: $agentName" }) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text(agentName, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            Text(
                "${if (status == "running") "\u25CF" else "\u25CB"} $status",
                fontSize = 13.sp,
                color = if (status == "running") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (status == "running") {
                TextButton(onClick = {
                    state = agentTimelineReduce(state, AgentTimelineEvent.Interrupt)
                    onInterrupt()
                }) { Text("Interrupt") }
            }
        }

        // Filter bar
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            FilterChip(selected = typeFilter == null, onClick = { typeFilter = null }, label = { Text("All", fontSize = 11.sp) })
            EntryType.entries.forEach { t ->
                FilterChip(
                    selected = typeFilter == t,
                    onClick = { typeFilter = if (typeFilter == t) null else t },
                    label = { Text("${t.icon} ${t.label}", fontSize = 11.sp) }
                )
            }
        }

        // Interrupted banner
        if (state == AgentTimelineState.Interrupted) {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text("Agent execution interrupted", modifier = Modifier.padding(8.dp), color = MaterialTheme.colorScheme.onErrorContainer)
            }
        }

        HorizontalDivider()

        // Timeline entries
        LazyColumn(state = listState, modifier = Modifier.weight(1f)) {
            itemsIndexed(visibleEntries, key = { _, e -> e.id }) { _, entry ->
                val isExpanded = entry.id in expandedIds
                val isSelected = selectedEntryId == entry.id
                val isRunning = entry.status == EntryStatus.Running

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedEntryId = entry.id
                            expandedIds = if (isExpanded) expandedIds - entry.id else expandedIds + entry.id
                            state = agentTimelineReduce(state, AgentTimelineEvent.SelectEntry(entry.id))
                        }
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(entry.type.icon, fontSize = 14.sp)
                        Text(entry.label, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        if (isRunning) { Text("\u25CB", fontSize = 12.sp, color = MaterialTheme.colorScheme.primary) }
                        if (entry.duration != null && entry.status != EntryStatus.Running) {
                            Text(formatDuration(entry.duration), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(entry.timestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    AnimatedVisibility(visible = isExpanded && entry.detail != null) {
                        entry.detail?.let {
                            Text(it, fontSize = 13.sp, modifier = Modifier.padding(start = 22.dp, top = 4.dp))
                        }
                    }
                }
            }
        }
    }
}
