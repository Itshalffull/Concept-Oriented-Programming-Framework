package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class ChatMessageState { Idle, Hovered, Streaming, Copied }

sealed class ChatMessageEvent {
    object Hover : ChatMessageEvent()
    object Leave : ChatMessageEvent()
    object StreamStart : ChatMessageEvent()
    object StreamEnd : ChatMessageEvent()
    object Copy : ChatMessageEvent()
    object CopyTimeout : ChatMessageEvent()
}

fun chatMessageReduce(state: ChatMessageState, event: ChatMessageEvent): ChatMessageState = when (state) {
    ChatMessageState.Idle -> when (event) {
        is ChatMessageEvent.Hover -> ChatMessageState.Hovered
        is ChatMessageEvent.StreamStart -> ChatMessageState.Streaming
        is ChatMessageEvent.Copy -> ChatMessageState.Copied
        else -> state
    }
    ChatMessageState.Hovered -> when (event) {
        is ChatMessageEvent.Leave -> ChatMessageState.Idle
        is ChatMessageEvent.Copy -> ChatMessageState.Copied
        is ChatMessageEvent.StreamStart -> ChatMessageState.Streaming
        else -> state
    }
    ChatMessageState.Streaming -> when (event) {
        is ChatMessageEvent.StreamEnd -> ChatMessageState.Idle
        else -> state
    }
    ChatMessageState.Copied -> when (event) {
        is ChatMessageEvent.CopyTimeout -> ChatMessageState.Idle
        else -> state
    }
}

// --- Types ---

enum class MessageRole(val avatar: String, val label: String) {
    User("\uD83D\uDC64", "User"),
    Assistant("\uD83E\uDD16", "Assistant"),
    System("\u2699", "System"),
    Tool("\uD83D\uDD27", "Tool")
}

// --- Component ---

@Composable
fun ChatMessage(
    role: MessageRole,
    content: String,
    timestamp: String,
    modifier: Modifier = Modifier,
    variant: String = "default",
    showAvatar: Boolean = true,
    showTimestamp: Boolean = true,
    isStreaming: Boolean = false,
    onCopy: () -> Unit = {},
    onRegenerate: () -> Unit = {},
    onEdit: () -> Unit = {}
) {
    var state by remember { mutableStateOf(if (isStreaming) ChatMessageState.Streaming else ChatMessageState.Idle) }
    val clipboardManager = LocalClipboardManager.current

    // Sync streaming prop
    LaunchedEffect(isStreaming) {
        state = if (isStreaming) chatMessageReduce(state, ChatMessageEvent.StreamStart)
        else if (state == ChatMessageState.Streaming) chatMessageReduce(state, ChatMessageEvent.StreamEnd)
        else state
    }

    // Copy timeout
    LaunchedEffect(state) {
        if (state == ChatMessageState.Copied) {
            delay(2000)
            state = chatMessageReduce(state, ChatMessageEvent.CopyTimeout)
        }
    }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "${role.label} message" }
            .padding(12.dp)
    ) {
        // Header row: avatar, role, timestamp
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 4.dp)
        ) {
            if (showAvatar) {
                Text(role.avatar, fontSize = 18.sp)
            }
            Text(role.label, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Spacer(Modifier.weight(1f))
            if (showTimestamp) {
                Text(timestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // Body
        Text(content, fontSize = 14.sp, lineHeight = 20.sp)

        // Streaming cursor
        if (isStreaming) {
            Text("\u258C", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
        }

        // Action toolbar
        if (!isStreaming) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(top = 4.dp)
            ) {
                TextButton(onClick = {
                    clipboardManager.setText(AnnotatedString(content))
                    state = chatMessageReduce(state, ChatMessageEvent.Copy)
                    onCopy()
                }) {
                    Text(if (state == ChatMessageState.Copied) "Copied!" else "Copy", fontSize = 11.sp)
                }

                if (role == MessageRole.Assistant) {
                    TextButton(onClick = onRegenerate) {
                        Text("Regenerate", fontSize = 11.sp)
                    }
                }

                if (role == MessageRole.User) {
                    TextButton(onClick = onEdit) {
                        Text("Edit", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}
