package com.clef.surface.widgets.concepts.processllm

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

enum class PromptEditorState { Viewing, MessageSelected, Testing }

sealed class PromptEditorEvent {
    data class SelectMessage(val messageId: String) : PromptEditorEvent()
    object Deselect : PromptEditorEvent()
    object StartTest : PromptEditorEvent()
    object TestComplete : PromptEditorEvent()
}

fun promptEditorReduce(
    state: PromptEditorState,
    event: PromptEditorEvent
): PromptEditorState = when (state) {
    PromptEditorState.Viewing -> when (event) {
        is PromptEditorEvent.SelectMessage -> PromptEditorState.MessageSelected
        is PromptEditorEvent.StartTest -> PromptEditorState.Testing
        else -> state
    }
    PromptEditorState.MessageSelected -> when (event) {
        is PromptEditorEvent.Deselect -> PromptEditorState.Viewing
        is PromptEditorEvent.SelectMessage -> PromptEditorState.MessageSelected
        else -> state
    }
    PromptEditorState.Testing -> when (event) {
        is PromptEditorEvent.TestComplete -> PromptEditorState.Viewing
        else -> state
    }
}

// --- Public types ---

data class PromptMessage(
    val id: String,
    val role: String, // system, user, assistant
    val content: String
)

data class PromptTool(
    val name: String,
    val description: String? = null,
    val enabled: Boolean = true
)

private val ROLE_ICONS = mapOf(
    "system" to "\u2699",
    "user" to "\uD83D\uDC64",
    "assistant" to "\uD83E\uDD16"
)

private val ROLE_COLORS = mapOf(
    "system" to Color(0xFFF59E0B),
    "user" to Color(0xFF3B82F6),
    "assistant" to Color(0xFF22C55E)
)

@Composable
fun PromptEditor(
    messages: List<PromptMessage>,
    modifier: Modifier = Modifier,
    tools: List<PromptTool> = emptyList(),
    onSelectMessage: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(PromptEditorState.Viewing) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Prompt editor" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Prompt (${messages.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (tools.isNotEmpty()) {
            item {
                Text(
                    "Tools: ${tools.count { it.enabled }}/${tools.size}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Messages displayed as read-only chips
        items(messages) { message ->
            val icon = ROLE_ICONS[message.role] ?: ""
            val color = ROLE_COLORS[message.role] ?: Color.Gray
            val isSelected = selectedId == message.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else message.id
                    selectedId = nextId
                    state = promptEditorReduce(
                        state,
                        if (nextId != null) PromptEditorEvent.SelectMessage(nextId)
                        else PromptEditorEvent.Deselect
                    )
                    if (nextId != null) onSelectMessage(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${message.role.replaceFirstChar { it.uppercase() }}",
                        color = color
                    )
                },
                secondaryLabel = {
                    Text(
                        text = message.content,
                        maxLines = if (isSelected) 5 else 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            )
        }

        // Tools section
        if (tools.isNotEmpty()) {
            item {
                ListHeader {
                    Text("Tools", style = MaterialTheme.typography.titleSmall)
                }
            }
            items(tools) { tool ->
                val enabledIcon = if (tool.enabled) "\u2713" else "\u2717"
                Chip(
                    onClick = {},
                    label = {
                        Text(
                            text = "$enabledIcon ${tool.name}",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            color = if (tool.enabled) MaterialTheme.colorScheme.onSurface else Color.Gray
                        )
                    },
                    secondaryLabel = tool.description?.let {
                        { Text(it, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                    }
                )
            }
        }
    }
}
