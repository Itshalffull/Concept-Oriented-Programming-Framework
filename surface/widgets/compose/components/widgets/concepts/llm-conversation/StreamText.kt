package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class StreamTextState { Idle, Streaming, Complete, Stopped }

sealed class StreamTextEvent {
    object StreamStart : StreamTextEvent()
    object Token : StreamTextEvent()
    object StreamEnd : StreamTextEvent()
    object Stop : StreamTextEvent()
}

fun streamTextReduce(state: StreamTextState, event: StreamTextEvent): StreamTextState = when (state) {
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
    cursorStyle: String = "bar",
    onStop: () -> Unit = {}
) {
    var state by remember { mutableStateOf(if (streaming) StreamTextState.Streaming else StreamTextState.Idle) }
    val scrollState = rememberScrollState()
    val prevStreaming = remember { mutableStateOf(streaming) }

    // Sync streaming prop with state machine
    LaunchedEffect(streaming) {
        val wasStreaming = prevStreaming.value
        prevStreaming.value = streaming
        if (streaming && !wasStreaming) {
            state = streamTextReduce(state, StreamTextEvent.StreamStart)
        } else if (!streaming && wasStreaming) {
            state = streamTextReduce(state, StreamTextEvent.StreamEnd)
        }
    }

    // Auto-scroll during streaming
    LaunchedEffect(content, state) {
        if (state == StreamTextState.Streaming) {
            scrollState.animateScrollTo(scrollState.maxValue)
        }
    }

    // Dispatch TOKEN on content change while streaming
    LaunchedEffect(content) {
        if (state == StreamTextState.Streaming && content.isNotEmpty()) {
            state = streamTextReduce(state, StreamTextEvent.Token)
        }
    }

    val isStreaming = state == StreamTextState.Streaming

    Column(
        modifier = modifier.semantics { contentDescription = "Streaming response" }
    ) {
        // Text content with scroll
        Column(
            modifier = Modifier
                .weight(1f, fill = false)
                .verticalScroll(scrollState)
        ) {
            Text(
                text = content,
                fontSize = 14.sp,
                lineHeight = 20.sp
            )

            // Streaming cursor
            if (isStreaming) {
                val cursorChar = when (cursorStyle) {
                    "block" -> "\u2588"
                    "underline" -> "_"
                    else -> "\u258C" // bar
                }
                Text(
                    text = cursorChar,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }

        // Stop button
        if (isStreaming) {
            TextButton(
                onClick = {
                    if (state == StreamTextState.Streaming) {
                        state = streamTextReduce(state, StreamTextEvent.Stop)
                        onStop()
                    }
                },
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Text("Stop", fontSize = 13.sp)
            }
        }
    }
}
