package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

enum class ConversationSidebarState { Idle, Searching }

sealed class ConversationSidebarEvent {
    object Search : ConversationSidebarEvent()
    object ClearSearch : ConversationSidebarEvent()
}

fun conversationSidebarReduce(
    state: ConversationSidebarState,
    event: ConversationSidebarEvent
): ConversationSidebarState = when (state) {
    ConversationSidebarState.Idle -> when (event) {
        is ConversationSidebarEvent.Search -> ConversationSidebarState.Searching
        else -> state
    }
    ConversationSidebarState.Searching -> when (event) {
        is ConversationSidebarEvent.ClearSearch -> ConversationSidebarState.Idle
        else -> state
    }
}

// --- Public types ---

data class ConversationItem(
    val id: String,
    val title: String,
    val lastMessage: String? = null,
    val timestamp: String? = null,
    val unread: Boolean = false
)

@Composable
fun ConversationSidebar(
    conversations: List<ConversationItem>,
    modifier: Modifier = Modifier,
    selectedId: String? = null,
    onSelect: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(ConversationSidebarState.Idle) }
    var currentSelectedId by remember { mutableStateOf(selectedId) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(selectedId) { currentSelectedId = selectedId }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Conversations" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Chats (${conversations.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(conversations) { conversation ->
            val isSelected = currentSelectedId == conversation.id
            val unreadMarker = if (conversation.unread) "\u25CF " else ""

            Chip(
                onClick = {
                    currentSelectedId = conversation.id
                    onSelect(conversation.id)
                },
                label = {
                    Text(
                        text = "$unreadMarker${conversation.title}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                secondaryLabel = conversation.lastMessage?.let {
                    { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                }
            )
        }
    }
}
