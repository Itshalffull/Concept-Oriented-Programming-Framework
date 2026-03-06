package com.clef.surface.widgets.concepts.llmagent

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
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ReasoningBlockState { Collapsed, Expanded, Streaming }

sealed class ReasoningBlockEvent {
    object Toggle : ReasoningBlockEvent()
    object StreamStart : ReasoningBlockEvent()
    object StreamEnd : ReasoningBlockEvent()
}

fun reasoningBlockReduce(
    state: ReasoningBlockState,
    event: ReasoningBlockEvent
): ReasoningBlockState = when (state) {
    ReasoningBlockState.Collapsed -> when (event) {
        is ReasoningBlockEvent.Toggle -> ReasoningBlockState.Expanded
        is ReasoningBlockEvent.StreamStart -> ReasoningBlockState.Streaming
        else -> state
    }
    ReasoningBlockState.Expanded -> when (event) {
        is ReasoningBlockEvent.Toggle -> ReasoningBlockState.Collapsed
        else -> state
    }
    ReasoningBlockState.Streaming -> when (event) {
        is ReasoningBlockEvent.StreamEnd -> ReasoningBlockState.Expanded
        else -> state
    }
}

@Composable
fun ReasoningBlock(
    content: String,
    modifier: Modifier = Modifier,
    label: String = "Thinking",
    streaming: Boolean = false,
    durationMs: Long? = null
) {
    var state by remember { mutableStateOf(if (streaming) ReasoningBlockState.Streaming else ReasoningBlockState.Collapsed) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(streaming) {
        state = if (streaming) {
            reasoningBlockReduce(state, ReasoningBlockEvent.StreamStart)
        } else if (state == ReasoningBlockState.Streaming) {
            reasoningBlockReduce(state, ReasoningBlockEvent.StreamEnd)
        } else state
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Reasoning block" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Chip(
                onClick = {
                    state = reasoningBlockReduce(state, ReasoningBlockEvent.Toggle)
                },
                label = {
                    val expandIcon = when (state) {
                        ReasoningBlockState.Collapsed -> "\u25B6"
                        ReasoningBlockState.Expanded -> "\u25BC"
                        ReasoningBlockState.Streaming -> "\u25BC"
                    }
                    val suffix = when {
                        state == ReasoningBlockState.Streaming -> " ..."
                        durationMs != null -> " (${durationMs}ms)"
                        else -> ""
                    }
                    Text("$expandIcon $label$suffix")
                }
            )
        }

        if (state != ReasoningBlockState.Collapsed) {
            item {
                Card(onClick = {}) {
                    Text(
                        text = content,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 20,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(8.dp)
                    )
                }
            }
        }
    }
}
