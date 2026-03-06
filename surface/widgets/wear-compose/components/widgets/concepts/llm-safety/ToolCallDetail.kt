package com.clef.surface.widgets.concepts.llmsafety

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ToolCallDetailState { Idle, Retrying }

sealed class ToolCallDetailEvent {
    object Retry : ToolCallDetailEvent()
    object RetryComplete : ToolCallDetailEvent()
    object RetryError : ToolCallDetailEvent()
}

fun toolCallDetailReduce(
    state: ToolCallDetailState,
    event: ToolCallDetailEvent
): ToolCallDetailState = when (state) {
    ToolCallDetailState.Idle -> when (event) {
        is ToolCallDetailEvent.Retry -> ToolCallDetailState.Retrying
        else -> state
    }
    ToolCallDetailState.Retrying -> when (event) {
        is ToolCallDetailEvent.RetryComplete -> ToolCallDetailState.Idle
        is ToolCallDetailEvent.RetryError -> ToolCallDetailState.Idle
        else -> state
    }
}

// --- Public types ---

enum class ToolCallStatus { Pending, Success, Error }

private val STATUS_ICONS = mapOf(
    ToolCallStatus.Pending to "\u23F3",
    ToolCallStatus.Success to "\u2713",
    ToolCallStatus.Error to "\u2717"
)

private val STATUS_COLORS = mapOf(
    ToolCallStatus.Pending to Color(0xFFF59E0B),
    ToolCallStatus.Success to Color(0xFF22C55E),
    ToolCallStatus.Error to Color(0xFFEF4444)
)

@Composable
fun ToolCallDetail(
    toolName: String,
    status: ToolCallStatus,
    modifier: Modifier = Modifier,
    input: String? = null,
    output: String? = null,
    error: String? = null,
    durationMs: Long? = null,
    onRetry: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ToolCallDetailState.Idle) }
    val listState = rememberScalingLazyListState()

    val icon = STATUS_ICONS[status] ?: "\u23F3"
    val color = STATUS_COLORS[status] ?: Color.Gray

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Tool call: $toolName" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$icon $toolName",
                    style = MaterialTheme.typography.titleSmall,
                    color = color
                )
            }
        }

        item {
            val durationLabel = durationMs?.let { " (${it}ms)" } ?: ""
            Text(
                "${status.name}$durationLabel",
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }

        input?.let { inp ->
            item {
                Card(onClick = {}) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text("Input", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = inp,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 6,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        output?.let { out ->
            item {
                Card(onClick = {}) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text("Output", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            text = out,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 6,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }

        error?.let { err ->
            item {
                Card(onClick = {}) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text("Error", style = MaterialTheme.typography.labelSmall, color = Color(0xFFEF4444))
                        Text(
                            text = err,
                            fontSize = 10.sp,
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis,
                            color = Color(0xFFEF4444)
                        )
                    }
                }
            }
        }

        if (status == ToolCallStatus.Error) {
            item {
                Button(
                    onClick = {
                        state = toolCallDetailReduce(state, ToolCallDetailEvent.Retry)
                        onRetry()
                    },
                    label = { Text("Retry") }
                )
            }
        }
    }
}
