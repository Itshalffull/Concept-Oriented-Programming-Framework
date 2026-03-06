package com.clef.surface.widgets.concepts.processfoundation

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
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ExecutionOverlayState { Idle, Live, Suspended, Completed, Failed, Cancelled }

sealed class ExecutionOverlayEvent {
    object Start : ExecutionOverlayEvent()
    object Suspend : ExecutionOverlayEvent()
    object Resume : ExecutionOverlayEvent()
    object Complete : ExecutionOverlayEvent()
    object Fail : ExecutionOverlayEvent()
    object Cancel : ExecutionOverlayEvent()
}

fun executionOverlayReduce(
    state: ExecutionOverlayState,
    event: ExecutionOverlayEvent
): ExecutionOverlayState = when (state) {
    ExecutionOverlayState.Idle -> when (event) {
        is ExecutionOverlayEvent.Start -> ExecutionOverlayState.Live
        else -> state
    }
    ExecutionOverlayState.Live -> when (event) {
        is ExecutionOverlayEvent.Suspend -> ExecutionOverlayState.Suspended
        is ExecutionOverlayEvent.Complete -> ExecutionOverlayState.Completed
        is ExecutionOverlayEvent.Fail -> ExecutionOverlayState.Failed
        is ExecutionOverlayEvent.Cancel -> ExecutionOverlayState.Cancelled
        else -> state
    }
    ExecutionOverlayState.Suspended -> when (event) {
        is ExecutionOverlayEvent.Resume -> ExecutionOverlayState.Live
        is ExecutionOverlayEvent.Cancel -> ExecutionOverlayState.Cancelled
        else -> state
    }
    else -> state
}

// --- Public types ---

data class ExecutionStep(
    val id: String,
    val label: String,
    val status: String, // active, complete, pending, failed, skipped
    val duration: String? = null
)

private val STEP_ICONS = mapOf(
    "active" to "\u25B6",
    "complete" to "\u2713",
    "pending" to "\u25CB",
    "failed" to "\u2717",
    "skipped" to "\u2298"
)

private val STEP_COLORS = mapOf(
    "active" to Color(0xFF3B82F6),
    "complete" to Color(0xFF22C55E),
    "pending" to Color(0xFF9CA3AF),
    "failed" to Color(0xFFEF4444),
    "skipped" to Color(0xFF6B7280)
)

@Composable
fun ExecutionOverlay(
    steps: List<ExecutionStep>,
    executionStatus: String,
    modifier: Modifier = Modifier,
    onCancel: () -> Unit = {}
) {
    var state by remember {
        mutableStateOf(
            when (executionStatus) {
                "live", "running" -> ExecutionOverlayState.Live
                "suspended" -> ExecutionOverlayState.Suspended
                "completed" -> ExecutionOverlayState.Completed
                "failed" -> ExecutionOverlayState.Failed
                "cancelled" -> ExecutionOverlayState.Cancelled
                else -> ExecutionOverlayState.Idle
            }
        )
    }
    val listState = rememberScalingLazyListState()

    val completed = steps.count { it.status == "complete" }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Execution overlay" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Execution $completed/${steps.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                executionStatus.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = when (executionStatus) {
                    "live", "running" -> Color(0xFF3B82F6)
                    "completed" -> Color(0xFF22C55E)
                    "failed" -> Color(0xFFEF4444)
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }

        items(steps) { step ->
            val icon = STEP_ICONS[step.status] ?: "\u25CB"
            val color = STEP_COLORS[step.status] ?: Color.Gray

            Chip(
                onClick = {},
                label = {
                    Text(
                        text = "$icon ${step.label}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = step.duration?.let {
                    { Text(it, style = MaterialTheme.typography.labelSmall) }
                }
            )
        }

        if (state == ExecutionOverlayState.Live) {
            item {
                Button(
                    onClick = {
                        state = executionOverlayReduce(state, ExecutionOverlayEvent.Cancel)
                        onCancel()
                    },
                    label = { Text("Cancel") }
                )
            }
        }
    }
}
