package com.clef.surface.widgets.concepts.llmprompt

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

enum class PromptTemplateEditorState { Viewing, MessageSelected }

sealed class PromptTemplateEditorEvent {
    data class SelectMessage(val index: Int) : PromptTemplateEditorEvent()
    object Deselect : PromptTemplateEditorEvent()
}

fun promptTemplateEditorReduce(
    state: PromptTemplateEditorState,
    event: PromptTemplateEditorEvent
): PromptTemplateEditorState = when (state) {
    PromptTemplateEditorState.Viewing -> when (event) {
        is PromptTemplateEditorEvent.SelectMessage -> PromptTemplateEditorState.MessageSelected
        else -> state
    }
    PromptTemplateEditorState.MessageSelected -> when (event) {
        is PromptTemplateEditorEvent.Deselect -> PromptTemplateEditorState.Viewing
        is PromptTemplateEditorEvent.SelectMessage -> PromptTemplateEditorState.MessageSelected
    }
}

// --- Public types ---

enum class MessageRole { System, User, Assistant }

data class TemplateMessage(
    val role: MessageRole,
    val content: String
)

data class TemplateVariable(
    val name: String,
    val type: String = "string",
    val defaultValue: String? = null
)

private val ROLE_ICONS = mapOf(
    MessageRole.System to "\u2699",
    MessageRole.User to "\uD83D\uDC64",
    MessageRole.Assistant to "\uD83E\uDD16"
)

private val ROLE_COLORS = mapOf(
    MessageRole.System to Color(0xFFF59E0B),
    MessageRole.User to Color(0xFF3B82F6),
    MessageRole.Assistant to Color(0xFF22C55E)
)

@Composable
fun PromptTemplateEditor(
    messages: List<TemplateMessage>,
    modifier: Modifier = Modifier,
    variables: List<TemplateVariable> = emptyList(),
    onSelectMessage: (Int) -> Unit = {}
) {
    var state by remember { mutableStateOf(PromptTemplateEditorState.Viewing) }
    var selectedIndex by remember { mutableStateOf<Int?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Prompt template" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Template (${messages.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        // Variables summary
        if (variables.isNotEmpty()) {
            item {
                Text(
                    "Vars: ${variables.joinToString { it.name }}",
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Messages as read-only chips
        val indexedMessages = messages.mapIndexed { idx, msg -> idx to msg }
        items(indexedMessages) { (idx, message) ->
            val icon = ROLE_ICONS[message.role] ?: ""
            val color = ROLE_COLORS[message.role] ?: Color.Gray
            val isSelected = selectedIndex == idx

            Chip(
                onClick = {
                    val nextIdx = if (isSelected) null else idx
                    selectedIndex = nextIdx
                    state = promptTemplateEditorReduce(
                        state,
                        if (nextIdx != null) PromptTemplateEditorEvent.SelectMessage(nextIdx)
                        else PromptTemplateEditorEvent.Deselect
                    )
                    if (nextIdx != null) onSelectMessage(nextIdx)
                },
                label = {
                    Text(
                        text = "$icon ${message.role.name}",
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
    }
}
