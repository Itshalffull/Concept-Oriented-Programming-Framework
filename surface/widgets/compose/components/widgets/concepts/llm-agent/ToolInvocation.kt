package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- View state machine ---

enum class ToolInvocationViewState { Collapsed, HoveredCollapsed, Expanded }

sealed class ToolInvocationViewEvent {
    object Expand : ToolInvocationViewEvent()
    object Collapse : ToolInvocationViewEvent()
    object Hover : ToolInvocationViewEvent()
    object Unhover : ToolInvocationViewEvent()
}

fun toolInvocationViewReduce(state: ToolInvocationViewState, event: ToolInvocationViewEvent): ToolInvocationViewState = when (state) {
    ToolInvocationViewState.Collapsed -> when (event) {
        is ToolInvocationViewEvent.Expand -> ToolInvocationViewState.Expanded
        is ToolInvocationViewEvent.Hover -> ToolInvocationViewState.HoveredCollapsed
        else -> state
    }
    ToolInvocationViewState.HoveredCollapsed -> when (event) {
        is ToolInvocationViewEvent.Unhover -> ToolInvocationViewState.Collapsed
        is ToolInvocationViewEvent.Expand -> ToolInvocationViewState.Expanded
        else -> state
    }
    ToolInvocationViewState.Expanded -> when (event) {
        is ToolInvocationViewEvent.Collapse -> ToolInvocationViewState.Collapsed
        else -> state
    }
}

// --- Execution state machine ---

enum class ToolInvocationExecState(val icon: String, val label: String) {
    Pending("\u23F3", "Pending"),
    Running("\u25CF", "Running"),
    Succeeded("\u2713", "Succeeded"),
    Failed("\u2717", "Failed")
}

sealed class ToolInvocationExecEvent {
    object Start : ToolInvocationExecEvent()
    object Complete : ToolInvocationExecEvent()
    object Error : ToolInvocationExecEvent()
    object Retry : ToolInvocationExecEvent()
}

fun toolInvocationExecReduce(state: ToolInvocationExecState, event: ToolInvocationExecEvent): ToolInvocationExecState = when (state) {
    ToolInvocationExecState.Pending -> when (event) {
        is ToolInvocationExecEvent.Start -> ToolInvocationExecState.Running
        else -> state
    }
    ToolInvocationExecState.Running -> when (event) {
        is ToolInvocationExecEvent.Complete -> ToolInvocationExecState.Succeeded
        is ToolInvocationExecEvent.Error -> ToolInvocationExecState.Failed
        else -> state
    }
    ToolInvocationExecState.Succeeded -> state
    ToolInvocationExecState.Failed -> when (event) {
        is ToolInvocationExecEvent.Retry -> ToolInvocationExecState.Pending
        else -> state
    }
}

private fun formatDuration(ms: Long): String =
    if (ms < 1000) "${ms}ms" else "${"%.1f".format(ms / 1000.0)}s"

@Composable
fun ToolInvocation(
    toolName: String,
    modifier: Modifier = Modifier,
    execStatus: ToolInvocationExecState = ToolInvocationExecState.Pending,
    input: String? = null,
    output: String? = null,
    error: String? = null,
    duration: Long? = null,
    onRetry: () -> Unit = {}
) {
    var viewState by remember { mutableStateOf(ToolInvocationViewState.Collapsed) }

    val isExpanded = viewState == ToolInvocationViewState.Expanded
    val statusColor = when (execStatus) {
        ToolInvocationExecState.Succeeded -> MaterialTheme.colorScheme.primary
        ToolInvocationExecState.Failed -> MaterialTheme.colorScheme.error
        ToolInvocationExecState.Running -> MaterialTheme.colorScheme.tertiary
        ToolInvocationExecState.Pending -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    OutlinedCard(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Tool invocation: $toolName" }
    ) {
        Column {
            // Header (always visible)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        viewState = if (isExpanded) toolInvocationViewReduce(viewState, ToolInvocationViewEvent.Collapse)
                        else toolInvocationViewReduce(viewState, ToolInvocationViewEvent.Expand)
                    }
                    .padding(12.dp)
            ) {
                Text("\u2699", fontSize = 16.sp, modifier = Modifier.padding(end = 8.dp))
                Text(toolName, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f))
                Text(execStatus.icon, color = statusColor, fontSize = 14.sp)
                if (execStatus == ToolInvocationExecState.Running) {
                    CircularProgressIndicator(modifier = Modifier.size(14.dp).padding(start = 4.dp), strokeWidth = 2.dp)
                }
                duration?.let {
                    Text(formatDuration(it), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 8.dp))
                }
                Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp, modifier = Modifier.padding(start = 8.dp))
            }

            // Expanded content
            AnimatedVisibility(visible = isExpanded) {
                Column(Modifier.padding(start = 12.dp, end = 12.dp, bottom = 12.dp)) {
                    HorizontalDivider(modifier = Modifier.padding(bottom = 8.dp))

                    // Input
                    input?.let { inputText ->
                        Text("Input", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(bottom = 2.dp))
                        Surface(tonalElevation = 1.dp, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                            Text(inputText, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                    }

                    // Output
                    output?.let { outputText ->
                        Text("Output", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(bottom = 2.dp))
                        Surface(tonalElevation = 1.dp, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                            Text(outputText, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                    }

                    // Error
                    error?.let { errorText ->
                        Text("Error", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(bottom = 2.dp))
                        Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
                            Text(errorText, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = MaterialTheme.colorScheme.onErrorContainer, modifier = Modifier.padding(8.dp))
                        }
                    }

                    // Retry button for failed
                    if (execStatus == ToolInvocationExecState.Failed) {
                        Button(onClick = onRetry, modifier = Modifier.padding(top = 8.dp)) { Text("Retry") }
                    }
                }
            }
        }
    }
}
