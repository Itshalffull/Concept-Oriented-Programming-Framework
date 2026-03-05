package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class MemoryInspectorState { Viewing, Searching, EntrySelected, Deleting }

sealed class MemoryInspectorEvent {
    object SwitchTab : MemoryInspectorEvent()
    object Search : MemoryInspectorEvent()
    data class SelectEntry(val id: String?) : MemoryInspectorEvent()
    object Clear : MemoryInspectorEvent()
    object Deselect : MemoryInspectorEvent()
    object Delete : MemoryInspectorEvent()
    object Confirm : MemoryInspectorEvent()
    object Cancel : MemoryInspectorEvent()
}

fun memoryInspectorReduce(state: MemoryInspectorState, event: MemoryInspectorEvent): MemoryInspectorState = when (state) {
    MemoryInspectorState.Viewing -> when (event) {
        is MemoryInspectorEvent.SwitchTab -> MemoryInspectorState.Viewing
        is MemoryInspectorEvent.Search -> MemoryInspectorState.Searching
        is MemoryInspectorEvent.SelectEntry -> MemoryInspectorState.EntrySelected
        else -> state
    }
    MemoryInspectorState.Searching -> when (event) {
        is MemoryInspectorEvent.Clear -> MemoryInspectorState.Viewing
        is MemoryInspectorEvent.SelectEntry -> MemoryInspectorState.EntrySelected
        else -> state
    }
    MemoryInspectorState.EntrySelected -> when (event) {
        is MemoryInspectorEvent.Deselect -> MemoryInspectorState.Viewing
        is MemoryInspectorEvent.Delete -> MemoryInspectorState.Deleting
        else -> state
    }
    MemoryInspectorState.Deleting -> when (event) {
        is MemoryInspectorEvent.Confirm -> MemoryInspectorState.Viewing
        is MemoryInspectorEvent.Cancel -> MemoryInspectorState.EntrySelected
        else -> state
    }
}

// --- Types ---

enum class MemoryEntryType(val label: String) {
    Fact("Facts"), Instruction("Instructions"), Conversation("Conversation"), ToolResult("Tool Results")
}

data class MemoryEntry(
    val id: String,
    val type: MemoryEntryType,
    val content: String,
    val source: String? = null,
    val timestamp: String? = null,
    val relevance: Float? = null
)

enum class MemoryTab(val label: String) { Working("Working"), Episodic("Episodic"), Semantic("Semantic"), Procedural("Procedural") }

private fun truncate(text: String, max: Int): String =
    if (text.length <= max) text else text.take(max) + "\u2026"

@Composable
fun MemoryInspector(
    entries: List<MemoryEntry>,
    totalTokens: Int,
    maxTokens: Int,
    modifier: Modifier = Modifier,
    activeTab: MemoryTab = MemoryTab.Working,
    showContext: Boolean = true,
    onDelete: (String) -> Unit = {},
    onTabChange: (MemoryTab) -> Unit = {}
) {
    var state by remember { mutableStateOf(MemoryInspectorState.Viewing) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedId by remember { mutableStateOf<String?>(null) }

    val filteredEntries = remember(entries, searchQuery) {
        if (searchQuery.isBlank()) entries
        else entries.filter {
            it.content.contains(searchQuery, ignoreCase = true) ||
                (it.source?.contains(searchQuery, ignoreCase = true) == true)
        }
    }

    val grouped = remember(filteredEntries) {
        MemoryEntryType.entries.associateWith { type -> filteredEntries.filter { it.type == type } }
            .filter { it.value.isNotEmpty() }
    }

    val selectedEntry = remember(selectedId, entries) { selectedId?.let { id -> entries.find { it.id == id } } }
    val tokenPercent = if (maxTokens > 0) (totalTokens.toFloat() / maxTokens).coerceAtMost(1f) else 0f

    Column(modifier = modifier.semantics { contentDescription = "Memory inspector" }) {
        // Tabs
        ScrollableTabRow(
            selectedTabIndex = MemoryTab.entries.indexOf(activeTab),
            modifier = Modifier.fillMaxWidth()
        ) {
            MemoryTab.entries.forEach { tab ->
                Tab(
                    selected = tab == activeTab,
                    onClick = {
                        state = memoryInspectorReduce(state, MemoryInspectorEvent.SwitchTab)
                        onTabChange(tab)
                    },
                    text = { Text(tab.label) }
                )
            }
        }

        // Search
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                state = if (it.isNotBlank()) memoryInspectorReduce(state, MemoryInspectorEvent.Search)
                else memoryInspectorReduce(state, MemoryInspectorEvent.Clear)
            },
            label = { Text("Search memories...") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)
        )

        // Context bar
        if (showContext) {
            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
                LinearProgressIndicator(progress = { tokenPercent }, modifier = Modifier.fillMaxWidth())
                Text(
                    "${"%,d".format(totalTokens)} / ${"%,d".format(maxTokens)} tokens",
                    fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
        }

        HorizontalDivider()

        // Entry list grouped by type
        LazyColumn(modifier = Modifier.weight(1f)) {
            grouped.forEach { (type, group) ->
                item("header-${type.name}") {
                    Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp)) {
                        Text(type.label, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                        Text("${group.size}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                items(group, key = { it.id }) { entry ->
                    val isSelected = selectedId == entry.id
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (isSelected) {
                                    selectedId = null
                                    state = memoryInspectorReduce(state, MemoryInspectorEvent.Deselect)
                                } else {
                                    selectedId = entry.id
                                    state = memoryInspectorReduce(state, MemoryInspectorEvent.SelectEntry(entry.id))
                                }
                            }
                            .then(if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f)) else Modifier)
                            .padding(horizontal = 12.dp, vertical = 4.dp)
                    ) {
                        Text(
                            if (isSelected) entry.content else truncate(entry.content, 120),
                            fontSize = 13.sp
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            entry.source?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            entry.timestamp?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                            entry.relevance?.let { Text("${(it * 100).toInt()}%", fontSize = 11.sp, color = MaterialTheme.colorScheme.primary) }
                        }

                        // Delete button
                        if (isSelected && state == MemoryInspectorState.EntrySelected) {
                            TextButton(onClick = { state = memoryInspectorReduce(state, MemoryInspectorEvent.Delete) }) {
                                Text("Delete", color = MaterialTheme.colorScheme.error)
                            }
                        }

                        // Delete confirmation
                        if (isSelected && state == MemoryInspectorState.Deleting) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                                Text("Delete this entry?", fontSize = 13.sp)
                                Button(onClick = {
                                    onDelete(entry.id)
                                    state = memoryInspectorReduce(state, MemoryInspectorEvent.Confirm)
                                    selectedId = null
                                }) { Text("Confirm") }
                                OutlinedButton(onClick = { state = memoryInspectorReduce(state, MemoryInspectorEvent.Cancel) }) { Text("Cancel") }
                            }
                        }
                    }
                }
            }

            if (filteredEntries.isEmpty()) {
                item("empty") {
                    Text(
                        if (searchQuery.isNotBlank()) "No matching entries found." else "No memory entries.",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
