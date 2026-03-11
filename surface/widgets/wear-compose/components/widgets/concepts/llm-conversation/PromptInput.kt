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
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class PromptInputState { Empty, Composing, Submitting }

sealed class PromptInputEvent {
    object Input : PromptInputEvent()
    object Clear : PromptInputEvent()
    object Submit : PromptInputEvent()
    object SubmitComplete : PromptInputEvent()
    object SubmitError : PromptInputEvent()
}

fun promptInputReduce(
    state: PromptInputState,
    event: PromptInputEvent
): PromptInputState = when (state) {
    PromptInputState.Empty -> when (event) {
        is PromptInputEvent.Input -> PromptInputState.Composing
        else -> state
    }
    PromptInputState.Composing -> when (event) {
        is PromptInputEvent.Clear -> PromptInputState.Empty
        is PromptInputEvent.Submit -> PromptInputState.Submitting
        else -> state
    }
    PromptInputState.Submitting -> when (event) {
        is PromptInputEvent.SubmitComplete -> PromptInputState.Empty
        is PromptInputEvent.SubmitError -> PromptInputState.Composing
        else -> state
    }
}

@Composable
fun PromptInput(
    value: String,
    modifier: Modifier = Modifier,
    placeholder: String = "Type a message...",
    disabled: Boolean = false,
    onSubmit: (String) -> Unit = {},
    onChange: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(if (value.isNotEmpty()) PromptInputState.Composing else PromptInputState.Empty) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(value) {
        state = if (value.isNotEmpty()) PromptInputState.Composing else PromptInputState.Empty
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Prompt input" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // On a watch, text input is typically delegated to voice or phone.
        // Display current value as read-only with action buttons.
        item {
            Card(onClick = {}) {
                Text(
                    text = value.ifEmpty { placeholder },
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 5,
                    overflow = TextOverflow.Ellipsis,
                    color = if (value.isEmpty()) MaterialTheme.colorScheme.onSurfaceVariant
                           else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        if (value.isNotEmpty() && !disabled) {
            item {
                Button(
                    onClick = {
                        state = promptInputReduce(state, PromptInputEvent.Submit)
                        onSubmit(value)
                    },
                    label = { Text("\u2191 Send") }
                )
            }
        }

        if (state == PromptInputState.Submitting) {
            item {
                Text(
                    "Sending...",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
