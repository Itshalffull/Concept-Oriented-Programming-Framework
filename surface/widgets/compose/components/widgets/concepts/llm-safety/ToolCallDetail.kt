package com.clef.surface.widgets.concepts.llmsafety

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class ToolCallDetailState { Idle, Retrying }

sealed class ToolCallDetailEvent {
    object ExpandArgs : ToolCallDetailEvent()
    object ExpandResult : ToolCallDetailEvent()
    object Retry : ToolCallDetailEvent()
    object RetryComplete : ToolCallDetailEvent()
    object RetryError : ToolCallDetailEvent()
}

fun toolCallDetailReduce(state: ToolCallDetailState, event: ToolCallDetailEvent): ToolCallDetailState = when (state) {
    ToolCallDetailState.Idle -> when (event) {
        is ToolCallDetailEvent.ExpandArgs -> ToolCallDetailState.Idle
        is ToolCallDetailEvent.ExpandResult -> ToolCallDetailState.Idle
        is ToolCallDetailEvent.Retry -> ToolCallDetailState.Retrying
        else -> state
    }
    ToolCallDetailState.Retrying -> when (event) {
        is ToolCallDetailEvent.RetryComplete -> ToolCallDetailState.Idle
        is ToolCallDetailEvent.RetryError -> ToolCallDetailState.Idle
        else -> state
    }
}

// --- Types ---

enum class ToolCallStatus(val label: String, val bgColor: Color, val fgColor: Color) {
    Pending("Pending", Color(0xFFFEF3C7), Color(0xFF92400E)),
    Success("Success", Color(0xFFD1FAE5), Color(0xFF065F46)),
    Error("Error", Color(0xFFFEE2E2), Color(0xFF991B1B))
}

// --- Helpers ---

private fun formatJson(value: String): String = try {
    val parsed = org.json.JSONObject(value)
    parsed.toString(2)
} catch (_: Exception) {
    try {
        val arr = org.json.JSONArray(value)
        arr.toString(2)
    } catch (_: Exception) {
        value
    }
}

@Composable
fun ToolCallDetail(
    toolName: String,
    input: String,
    modifier: Modifier = Modifier,
    output: String? = null,
    status: ToolCallStatus = ToolCallStatus.Pending,
    duration: Long? = null,
    timestamp: String? = null,
    tokenUsage: Int? = null,
    error: String? = null,
    showTiming: Boolean = true,
    showTokens: Boolean = true,
    onRetry: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ToolCallDetailState.Idle) }
    var argsExpanded by remember { mutableStateOf(true) }
    var resultExpanded by remember { mutableStateOf(true) }
    val clipboardManager = LocalClipboardManager.current

    val resolvedStatus = if (error != null) ToolCallStatus.Error else status
    val formattedInput = remember(input) { formatJson(input) }
    val formattedOutput = remember(output) { output?.let { formatJson(it) } ?: "" }
    val errorMessage = error ?: if (resolvedStatus == ToolCallStatus.Error && output != null) output else null

    Column(
        modifier = modifier.semantics { contentDescription = "Tool call: $toolName" }
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth().padding(10.dp)
        ) {
            Text(toolName, fontWeight = FontWeight.SemiBold, fontFamily = FontFamily.Monospace, fontSize = 14.sp)
            Surface(
                color = resolvedStatus.bgColor,
                shape = MaterialTheme.shapes.small
            ) {
                Text(
                    resolvedStatus.label,
                    fontSize = 12.sp,
                    color = resolvedStatus.fgColor,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }
            Spacer(Modifier.weight(1f))
            if (duration != null && showTiming) {
                Text("${duration}ms", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        HorizontalDivider()

        // Input section
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        argsExpanded = !argsExpanded
                        state = toolCallDetailReduce(state, ToolCallDetailEvent.ExpandArgs)
                    }
                    .padding(8.dp)
            ) {
                Text(if (argsExpanded) "\u25BE" else "\u25B8", fontSize = 12.sp)
                Spacer(Modifier.width(6.dp))
                Text("Input", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { clipboardManager.setText(AnnotatedString(formattedInput)) }) {
                    Text("Copy", fontSize = 11.sp)
                }
            }
            AnimatedVisibility(visible = argsExpanded) {
                Text(
                    formattedInput,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
        }

        HorizontalDivider()

        // Output / Error section
        if (output != null || errorMessage != null) {
            Column(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            resultExpanded = !resultExpanded
                            state = toolCallDetailReduce(state, ToolCallDetailEvent.ExpandResult)
                        }
                        .padding(8.dp)
                ) {
                    Text(if (resultExpanded) "\u25BE" else "\u25B8", fontSize = 12.sp)
                    Spacer(Modifier.width(6.dp))
                    Text("Output", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { clipboardManager.setText(AnnotatedString(errorMessage ?: formattedOutput)) }) {
                        Text("Copy", fontSize = 11.sp)
                    }
                }
                AnimatedVisibility(visible = resultExpanded) {
                    if (resolvedStatus == ToolCallStatus.Error && errorMessage != null) {
                        Text(
                            errorMessage,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            color = Color(0xFF991B1B),
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    } else {
                        Text(
                            formattedOutput,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
                        )
                    }
                }
            }
            HorizontalDivider()
        }

        // Token usage badge
        if (showTokens && tokenUsage != null) {
            Text(
                "$tokenUsage tokens",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )
        }

        // Timestamp
        if (timestamp != null) {
            Text(
                timestamp,
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            )
        }

        // Retry button
        if (errorMessage != null) {
            TextButton(
                onClick = {
                    if (state != ToolCallDetailState.Retrying) {
                        state = toolCallDetailReduce(state, ToolCallDetailEvent.Retry)
                        onRetry()
                    }
                },
                enabled = state != ToolCallDetailState.Retrying,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(if (state == ToolCallDetailState.Retrying) "Retrying\u2026" else "Retry", fontSize = 13.sp)
            }
        }
    }
}
