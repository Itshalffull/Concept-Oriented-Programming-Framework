package com.clef.surface.widgets.concepts.llmconversation

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
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ChatMessageState { Idle, Streaming }

sealed class ChatMessageEvent {
    object StreamStart : ChatMessageEvent()
    object StreamEnd : ChatMessageEvent()
}

fun chatMessageReduce(
    state: ChatMessageState,
    event: ChatMessageEvent
): ChatMessageState = when (state) {
    ChatMessageState.Idle -> when (event) {
        is ChatMessageEvent.StreamStart -> ChatMessageState.Streaming
        else -> state
    }
    ChatMessageState.Streaming -> when (event) {
        is ChatMessageEvent.StreamEnd -> ChatMessageState.Idle
        else -> state
    }
}

// --- Public types ---

private val ROLE_ICONS = mapOf(
    "user" to "\uD83D\uDC64",
    "assistant" to "\uD83E\uDD16",
    "system" to "\u2699",
    "tool" to "\uD83D\uDD27"
)

@Composable
fun ChatMessage(
    role: String,
    content: String,
    timestamp: String,
    modifier: Modifier = Modifier,
    streaming: Boolean = false,
    showAvatar: Boolean = true
) {
    var state by remember { mutableStateOf(if (streaming) ChatMessageState.Streaming else ChatMessageState.Idle) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(streaming) {
        state = if (streaming) chatMessageReduce(state, ChatMessageEvent.StreamStart)
        else chatMessageReduce(state, ChatMessageEvent.StreamEnd)
    }

    val icon = ROLE_ICONS[role] ?: "\uD83D\uDC64"
    val roleLabel = role.replaceFirstChar { it.uppercase() }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "$roleLabel message" },
        state = listState,
        horizontalAlignment = if (role == "user") Alignment.End else Alignment.Start
    ) {
        item {
            Card(onClick = {}) {
                Column(modifier = Modifier.padding(8.dp)) {
                    if (showAvatar) {
                        Text(
                            text = "$icon $roleLabel",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(2.dp))
                    }
                    Text(
                        text = if (streaming) "$content\u258C" else content,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 20,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = timestamp,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
