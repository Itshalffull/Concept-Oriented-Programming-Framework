package com.clef.surface.widgets.concepts.llmconversation

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

enum class ConversationSidebarState { Idle, Searching, ContextOpen }

sealed class ConversationSidebarEvent {
    object Search : ConversationSidebarEvent()
    object Select : ConversationSidebarEvent()
    object ContextMenu : ConversationSidebarEvent()
    object ClearSearch : ConversationSidebarEvent()
    object CloseContext : ConversationSidebarEvent()
    object Action : ConversationSidebarEvent()
}

fun conversationSidebarReduce(state: ConversationSidebarState, event: ConversationSidebarEvent): ConversationSidebarState = when (state) {
    ConversationSidebarState.Idle -> when (event) {
        is ConversationSidebarEvent.Search -> ConversationSidebarState.Searching
        is ConversationSidebarEvent.Select -> ConversationSidebarState.Idle
        is ConversationSidebarEvent.ContextMenu -> ConversationSidebarState.ContextOpen
        else -> state
    }
    ConversationSidebarState.Searching -> when (event) {
        is ConversationSidebarEvent.ClearSearch -> ConversationSidebarState.Idle
        is ConversationSidebarEvent.Select -> ConversationSidebarState.Idle
        else -> state
    }
    ConversationSidebarState.ContextOpen -> when (event) {
        is ConversationSidebarEvent.CloseContext -> ConversationSidebarState.Idle
        is ConversationSidebarEvent.Action -> ConversationSidebarState.Idle
        else -> state
    }
}

// --- Types ---

data class ConversationItem(
    val id: String,
    val title: String,
    val lastMessage: String,
    val timestamp: String,
    val messageCount: Int,
    val isActive: Boolean = false,
    val model: String? = null,
    val folder: String? = null
)

data class ConversationGroup(val label: String, val items: List<ConversationItem>)

// --- Helpers ---

private fun truncate(text: String, max: Int): String =
    if (text.length <= max) text else text.take(max) + "\u2026"

private fun groupByDate(conversations: List<ConversationItem>): List<ConversationGroup> {
    // Simplified grouping: just split into groups by folder or single group
    return listOf(ConversationGroup("All", conversations))
}

@Composable
fun ConversationSidebar(
    conversations: List<ConversationItem>,
    modifier: Modifier = Modifier,
    selectedId: String? = null,
    showPreview: Boolean = true,
    showModel: Boolean = true,
    previewMaxLength: Int = 80,
    onSelect: (String) -> Unit = {},
    onCreate: () -> Unit = {},
    onDelete: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(ConversationSidebarState.Idle) }
    var searchQuery by remember { mutableStateOf("") }

    val filtered = remember(conversations, searchQuery) {
        if (searchQuery.isBlank()) conversations
        else conversations.filter {
            it.title.contains(searchQuery, ignoreCase = true) ||
                it.lastMessage.contains(searchQuery, ignoreCase = true)
        }
    }

    val groups = remember(filtered) { groupByDate(filtered) }

    Column(modifier = modifier.semantics { contentDescription = "Conversation history sidebar" }) {
        // Search
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                state = if (it.isNotBlank()) conversationSidebarReduce(state, ConversationSidebarEvent.Search)
                else conversationSidebarReduce(state, ConversationSidebarEvent.ClearSearch)
            },
            label = { Text("Search conversations\u2026") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)
        )

        // New conversation button
        Button(
            onClick = { onCreate() },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
        ) { Text("+ New conversation") }

        HorizontalDivider()

        // Conversation list
        LazyColumn(modifier = Modifier.weight(1f)) {
            groups.forEach { group ->
                if (groups.size > 1) {
                    item("header-${group.label}") {
                        Text(
                            group.label,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                        )
                    }
                }

                items(group.items, key = { it.id }) { item ->
                    val isSelected = item.id == selectedId

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                state = conversationSidebarReduce(state, ConversationSidebarEvent.Select)
                                onSelect(item.id)
                            }
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                item.title,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 14.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                "${item.messageCount}",
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        if (showPreview) {
                            Text(
                                truncate(item.lastMessage, previewMaxLength),
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }

                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 2.dp)
                        ) {
                            Text(item.timestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (showModel && item.model != null) {
                                Text(item.model, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary)
                            }
                        }
                    }
                }
            }

            if (filtered.isEmpty()) {
                item("empty") {
                    Text(
                        if (searchQuery.isNotBlank()) "No conversations match your search."
                        else "No conversations yet.",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
