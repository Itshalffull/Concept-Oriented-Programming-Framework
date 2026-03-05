package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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

enum class ReasoningBlockState { Collapsed, Expanded, Streaming }

sealed class ReasoningBlockEvent {
    object Toggle : ReasoningBlockEvent()
    object StreamStart : ReasoningBlockEvent()
    object StreamEnd : ReasoningBlockEvent()
}

fun reasoningBlockReduce(state: ReasoningBlockState, event: ReasoningBlockEvent): ReasoningBlockState = when (state) {
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

private fun formatDuration(ms: Long): String =
    if (ms < 1000) "${ms}ms" else "${"%.1f".format(ms / 1000.0)}s"

@Composable
fun ReasoningBlock(
    content: String,
    modifier: Modifier = Modifier,
    summary: String? = null,
    isStreaming: Boolean = false,
    duration: Long? = null,
    initialExpanded: Boolean = false
) {
    var state by remember {
        mutableStateOf(
            when {
                isStreaming -> ReasoningBlockState.Streaming
                initialExpanded -> ReasoningBlockState.Expanded
                else -> ReasoningBlockState.Collapsed
            }
        )
    }

    // Sync streaming state
    LaunchedEffect(isStreaming) {
        state = if (isStreaming) {
            reasoningBlockReduce(state, ReasoningBlockEvent.StreamStart)
        } else if (state == ReasoningBlockState.Streaming) {
            reasoningBlockReduce(state, ReasoningBlockEvent.StreamEnd)
        } else state
    }

    val isExpanded = state == ReasoningBlockState.Expanded || state == ReasoningBlockState.Streaming
    val headerText = when {
        state == ReasoningBlockState.Streaming -> "Thinking\u2026"
        summary != null -> summary
        content.length > 80 -> content.take(80) + "\u2026"
        else -> content
    }

    Surface(
        tonalElevation = 1.dp,
        shape = MaterialTheme.shapes.small,
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Reasoning block" }
    ) {
        Column {
            // Header
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        if (state != ReasoningBlockState.Streaming) {
                            state = reasoningBlockReduce(state, ReasoningBlockEvent.Toggle)
                        }
                    }
                    .padding(12.dp)
            ) {
                Text("\u2022\u2022\u2022", fontSize = 14.sp, modifier = Modifier.padding(end = 8.dp))
                Text(
                    headerText,
                    fontWeight = FontWeight.Medium,
                    fontSize = 14.sp,
                    maxLines = if (isExpanded) Int.MAX_VALUE else 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (state == ReasoningBlockState.Streaming) {
                    CircularProgressIndicator(modifier = Modifier.size(16.dp).padding(start = 8.dp), strokeWidth = 2.dp)
                }
                duration?.let {
                    Text(formatDuration(it), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 8.dp))
                }
                Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp, modifier = Modifier.padding(start = 8.dp))
            }

            // Body
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(),
                exit = shrinkVertically()
            ) {
                Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)) {
                    HorizontalDivider(modifier = Modifier.padding(bottom = 8.dp))
                    Text(content, fontSize = 13.sp, lineHeight = 20.sp)
                    if (state == ReasoningBlockState.Streaming) {
                        Text("\u258C", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
            }
        }
    }
}
