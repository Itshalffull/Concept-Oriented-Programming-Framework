package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class TraceTreeState { Idle, SpanSelected }

sealed class TraceTreeEvent {
    data class SelectSpan(val id: String) : TraceTreeEvent()
    object Deselect : TraceTreeEvent()
}

fun traceTreeReduce(state: TraceTreeState, event: TraceTreeEvent): TraceTreeState = when (state) {
    TraceTreeState.Idle -> when (event) {
        is TraceTreeEvent.SelectSpan -> TraceTreeState.SpanSelected
        else -> state
    }
    TraceTreeState.SpanSelected -> when (event) {
        is TraceTreeEvent.Deselect -> TraceTreeState.Idle
        is TraceTreeEvent.SelectSpan -> TraceTreeState.SpanSelected
        else -> state
    }
}

// --- Types ---

enum class SpanType(val icon: String, val label: String) {
    Llm("\u2605", "LLM"),
    Tool("\u2699", "Tool"),
    Chain("\u2192", "Chain"),
    Agent("\u2606", "Agent")
}

enum class SpanStatus { Running, Complete, Error }

data class TraceSpan(
    val id: String,
    val type: SpanType,
    val label: String,
    val duration: Long? = null,
    val tokens: Int? = null,
    val status: SpanStatus = SpanStatus.Complete,
    val children: List<TraceSpan> = emptyList()
)

// --- Helpers ---

private fun flattenSpans(spans: List<TraceSpan>, expandedIds: Set<String>, typeFilter: Set<SpanType>?, depth: Int = 0): List<Pair<TraceSpan, Int>> {
    val result = mutableListOf<Pair<TraceSpan, Int>>()
    for (span in spans) {
        if (typeFilter != null && span.type !in typeFilter) continue
        result.add(span to depth)
        if (span.id in expandedIds && span.children.isNotEmpty()) {
            result.addAll(flattenSpans(span.children, expandedIds, typeFilter, depth + 1))
        }
    }
    return result
}

private fun findSpan(spans: List<TraceSpan>, id: String): TraceSpan? {
    for (span in spans) {
        if (span.id == id) return span
        val found = findSpan(span.children, id)
        if (found != null) return found
    }
    return null
}

private fun computeTotals(spans: List<TraceSpan>): Triple<Long, Int, Int> {
    var duration = 0L
    var tokens = 0
    var count = 0
    fun walk(s: List<TraceSpan>) {
        for (span in s) {
            count++
            duration += span.duration ?: 0
            tokens += span.tokens ?: 0
            walk(span.children)
        }
    }
    walk(spans)
    return Triple(duration, tokens, count)
}

private fun formatDuration(ms: Long): String =
    if (ms < 1000) "${ms}ms" else "${"%.1f".format(ms / 1000.0)}s"

@Composable
fun TraceTree(
    spans: List<TraceSpan>,
    modifier: Modifier = Modifier,
    onSelectSpan: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(TraceTreeState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var expandedIds by remember { mutableStateOf(emptySet<String>()) }
    var typeFilter by remember { mutableStateOf<Set<SpanType>?>(null) }

    val flatList = remember(spans, expandedIds, typeFilter) { flattenSpans(spans, expandedIds, typeFilter) }
    val (totalDuration, totalTokens, totalCount) = remember(spans) { computeTotals(spans) }
    val selectedSpan = remember(selectedId, spans) { selectedId?.let { findSpan(spans, it) } }

    fun handleSelect(id: String) {
        val nextId = if (id == selectedId) null else id
        selectedId = nextId
        onSelectSpan(nextId)
        state = if (nextId != null) traceTreeReduce(state, TraceTreeEvent.SelectSpan(nextId))
        else traceTreeReduce(state, TraceTreeEvent.Deselect)
    }

    Column(modifier = modifier.semantics { contentDescription = "Execution trace tree" }) {
        // Summary header
        Row(
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text("$totalCount spans", fontSize = 13.sp)
            Text(formatDuration(totalDuration), fontSize = 13.sp)
            Text("$totalTokens tokens", fontSize = 13.sp)
        }

        // Filter toggles
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            FilterChip(selected = typeFilter == null, onClick = { typeFilter = null }, label = { Text("All", fontSize = 11.sp) })
            SpanType.entries.forEach { t ->
                val isActive = typeFilter?.contains(t) == true
                FilterChip(
                    selected = isActive,
                    onClick = {
                        typeFilter = if (typeFilter == null) setOf(t)
                        else if (isActive) (typeFilter!! - t).ifEmpty { null }
                        else typeFilter!! + t
                    },
                    label = { Text("${t.icon} ${t.label}", fontSize = 11.sp) }
                )
            }
        }

        HorizontalDivider()

        // Tree
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(flatList, key = { it.first.id }) { (span, depth) ->
                val isSelected = span.id == selectedId
                val hasChildren = span.children.isNotEmpty()
                val isExpanded = span.id in expandedIds

                val statusColor = when (span.status) {
                    SpanStatus.Complete -> MaterialTheme.colorScheme.primary
                    SpanStatus.Running -> MaterialTheme.colorScheme.tertiary
                    SpanStatus.Error -> MaterialTheme.colorScheme.error
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { handleSelect(span.id) }
                        .padding(start = (12 + depth * 20).dp, end = 12.dp, top = 2.dp, bottom = 2.dp)
                ) {
                    if (hasChildren) {
                        TextButton(
                            onClick = { expandedIds = if (isExpanded) expandedIds - span.id else expandedIds + span.id },
                            contentPadding = PaddingValues(0.dp),
                            modifier = Modifier.size(24.dp)
                        ) { Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp) }
                    } else {
                        Spacer(Modifier.size(24.dp))
                    }

                    Text(span.type.icon, fontSize = 14.sp, color = statusColor, modifier = Modifier.padding(horizontal = 4.dp))
                    Text(span.label, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    span.duration?.let { Text(formatDuration(it), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    span.tokens?.let { Text("${it}t", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 4.dp)) }
                }
            }
        }

        // Detail panel
        selectedSpan?.let { span ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text("${span.type.icon} ${span.label}", fontWeight = FontWeight.Bold)
                Text("Type: ${span.type.label}", fontSize = 13.sp)
                Text("Status: ${span.status.name}", fontSize = 13.sp)
                span.duration?.let { Text("Duration: ${formatDuration(it)}", fontSize = 13.sp) }
                span.tokens?.let { Text("Tokens: $it", fontSize = 13.sp) }
                if (span.children.isNotEmpty()) Text("Children: ${span.children.size}", fontSize = 13.sp)
            }
        }
    }
}
