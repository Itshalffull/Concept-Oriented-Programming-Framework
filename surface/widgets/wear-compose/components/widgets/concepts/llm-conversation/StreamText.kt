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

enum class StreamTextState { Idle, Streaming, Complete, Stopped }

sealed class StreamTextEvent {
    object StreamStart : StreamTextEvent()
    object Token : StreamTextEvent()
    object StreamEnd : StreamTextEvent()
    object Stop : StreamTextEvent()
}

fun streamTextReduce(
    state: StreamTextState,
    event: StreamTextEvent
): StreamTextState = when (state) {
    StreamTextState.Idle -> when (event) {
        is StreamTextEvent.StreamStart -> StreamTextState.Streaming
        else -> state
    }
    StreamTextState.Streaming -> when (event) {
        is StreamTextEvent.Token -> StreamTextState.Streaming
        is StreamTextEvent.StreamEnd -> StreamTextState.Complete
        is StreamTextEvent.Stop -> StreamTextState.Stopped
        else -> state
    }
    StreamTextState.Complete -> when (event) {
        is StreamTextEvent.StreamStart -> StreamTextState.Streaming
        else -> state
    }
    StreamTextState.Stopped -> when (event) {
        is StreamTextEvent.StreamStart -> StreamTextState.Streaming
        else -> state
    }
}

@Composable
fun StreamText(
    content: String,
    streaming: Boolean,
    modifier: Modifier = Modifier,
    onStop: () -> Unit = {}
) {
    var state by remember { mutableStateOf(if (streaming) StreamTextState.Streaming else StreamTextState.Idle) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(streaming) {
        state = if (streaming) streamTextReduce(state, StreamTextEvent.StreamStart)
        else if (state == StreamTextState.Streaming) streamTextReduce(state, StreamTextEvent.StreamEnd)
        else state
    }

    LaunchedEffect(content) {
        if (state == StreamTextState.Streaming) {
            state = streamTextReduce(state, StreamTextEvent.Token)
        }
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Streaming text" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Card(onClick = {}) {
                Text(
                    text = if (state == StreamTextState.Streaming) "$content\u258C" else content,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 50,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        if (state == StreamTextState.Streaming) {
            item {
                Button(
                    onClick = {
                        state = streamTextReduce(state, StreamTextEvent.Stop)
                        onStop()
                    },
                    label = { Text("\u23F9 Stop") }
                )
            }
        }

        if (state == StreamTextState.Complete) {
            item {
                Text(
                    "\u2713 Complete",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
