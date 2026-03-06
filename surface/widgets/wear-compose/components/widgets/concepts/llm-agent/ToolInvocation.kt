package com.clef.surface.widgets.concepts.llmagent

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
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ToolInvocationViewState { Collapsed, Expanded }

enum class ToolInvocationExecState { Pending, Running, Succeeded, Failed }

sealed class ToolInvocationEvent {
    object Toggle : ToolInvocationEvent()
}

fun toolInvocationViewReduce(
    state: ToolInvocationViewState,
    event: ToolInvocationEvent
): ToolInvocationViewState = when (state) {
    ToolInvocationViewState.Collapsed -> when (event) {
        is ToolInvocationEvent.Toggle -> ToolInvocationViewState.Expanded
    }
    ToolInvocationViewState.Expanded -> when (event) {
        is ToolInvocationEvent.Toggle -> ToolInvocationViewState.Collapsed
    }
}

private val EXEC_ICONS = mapOf(
    ToolInvocationExecState.Pending to "\u23F3",
    ToolInvocationExecState.Running to "\u25B6",
    ToolInvocationExecState.Succeeded to "\u2713",
    ToolInvocationExecState.Failed to "\u2717"
)

private val EXEC_COLORS = mapOf(
    ToolInvocationExecState.Pending to Color(0xFFF59E0B),
    ToolInvocationExecState.Running to Color(0xFF3B82F6),
    ToolInvocationExecState.Succeeded to Color(0xFF22C55E),
    ToolInvocationExecState.Failed to Color(0xFFEF4444)
)

@Composable
fun ToolInvocation(
    toolName: String,
    status: String,
    modifier: Modifier = Modifier,
    input: String? = null,
    output: String? = null,
    durationMs: Long? = null,
    error: String? = null
) {
    var viewState by remember { mutableStateOf(ToolInvocationViewState.Collapsed) }
    val listState = rememberScalingLazyListState()

    val execState = when (status) {
        "running" -> ToolInvocationExecState.Running
        "succeeded", "success" -> ToolInvocationExecState.Succeeded
        "failed", "error" -> ToolInvocationExecState.Failed
        else -> ToolInvocationExecState.Pending
    }

    val icon = EXEC_ICONS[execState] ?: "\u23F3"
    val color = EXEC_COLORS[execState] ?: Color.Gray

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Tool invocation: $toolName" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Chip(
                onClick = {
                    viewState = toolInvocationViewReduce(viewState, ToolInvocationEvent.Toggle)
                },
                label = {
                    val expandIcon = if (viewState == ToolInvocationViewState.Expanded) "\u25BC" else "\u25B6"
                    Text(
                        text = "$expandIcon $icon $toolName",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = {
                    val durationLabel = durationMs?.let { " (${it}ms)" } ?: ""
                    Text("${execState.name}$durationLabel", style = MaterialTheme.typography.labelSmall)
                }
            )
        }

        if (viewState == ToolInvocationViewState.Expanded) {
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
        }
    }
}
