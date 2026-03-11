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

enum class MemoryInspectorState { Viewing, EntrySelected }

sealed class MemoryInspectorEvent {
    data class SelectEntry(val entryId: String) : MemoryInspectorEvent()
    object Deselect : MemoryInspectorEvent()
}

fun memoryInspectorReduce(
    state: MemoryInspectorState,
    event: MemoryInspectorEvent
): MemoryInspectorState = when (state) {
    MemoryInspectorState.Viewing -> when (event) {
        is MemoryInspectorEvent.SelectEntry -> MemoryInspectorState.EntrySelected
        else -> state
    }
    MemoryInspectorState.EntrySelected -> when (event) {
        is MemoryInspectorEvent.Deselect -> MemoryInspectorState.Viewing
        is MemoryInspectorEvent.SelectEntry -> MemoryInspectorState.EntrySelected
    }
}

// --- Public types ---

enum class MemoryEntryType { Fact, Instruction, Conversation, ToolResult }

data class MemoryEntry(
    val id: String,
    val type: MemoryEntryType,
    val content: String,
    val timestamp: String? = null,
    val relevance: Float? = null,
    val source: String? = null
)

private val TYPE_ICONS = mapOf(
    MemoryEntryType.Fact to "\uD83D\uDCCB",
    MemoryEntryType.Instruction to "\u2699",
    MemoryEntryType.Conversation to "\uD83D\uDCAC",
    MemoryEntryType.ToolResult to "\uD83D\uDD27"
)

@Composable
fun MemoryInspector(
    entries: List<MemoryEntry>,
    modifier: Modifier = Modifier,
    onSelectEntry: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(MemoryInspectorState.Viewing) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Memory inspector" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Memory (${entries.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(entries) { entry ->
            val icon = TYPE_ICONS[entry.type] ?: ""
            val isSelected = selectedId == entry.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else entry.id
                    selectedId = nextId
                    state = memoryInspectorReduce(
                        state,
                        if (nextId != null) MemoryInspectorEvent.SelectEntry(nextId)
                        else MemoryInspectorEvent.Deselect
                    )
                    if (nextId != null) onSelectEntry(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${entry.content}",
                        maxLines = if (isSelected) 3 else 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.labelSmall
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text(entry.type.name, style = MaterialTheme.typography.labelSmall)
                            entry.relevance?.let {
                                Text(
                                    "Relevance: ${(it * 100).toInt()}%",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            entry.source?.let {
                                Text("Source: $it", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                } else null
            )
        }
    }
}
