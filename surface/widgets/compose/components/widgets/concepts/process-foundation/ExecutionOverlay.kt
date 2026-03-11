package com.clef.surface.widgets.concepts.processfoundation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class ExecutionOverlayState { Idle, Live, Suspended, Completed, Failed, Cancelled, Replay }

sealed class ExecutionOverlayEvent {
    object Start : ExecutionOverlayEvent()
    object LoadReplay : ExecutionOverlayEvent()
    object StepAdvance : ExecutionOverlayEvent()
    object Complete : ExecutionOverlayEvent()
    object Fail : ExecutionOverlayEvent()
    object Suspend : ExecutionOverlayEvent()
    object Cancel : ExecutionOverlayEvent()
    object Resume : ExecutionOverlayEvent()
    object Reset : ExecutionOverlayEvent()
    object Retry : ExecutionOverlayEvent()
    object ReplayStep : ExecutionOverlayEvent()
    object ReplayEnd : ExecutionOverlayEvent()
}

fun executionOverlayReduce(state: ExecutionOverlayState, event: ExecutionOverlayEvent): ExecutionOverlayState = when (state) {
    ExecutionOverlayState.Idle -> when (event) {
        is ExecutionOverlayEvent.Start -> ExecutionOverlayState.Live
        is ExecutionOverlayEvent.LoadReplay -> ExecutionOverlayState.Replay
        else -> state
    }
    ExecutionOverlayState.Live -> when (event) {
        is ExecutionOverlayEvent.StepAdvance -> ExecutionOverlayState.Live
        is ExecutionOverlayEvent.Complete -> ExecutionOverlayState.Completed
        is ExecutionOverlayEvent.Fail -> ExecutionOverlayState.Failed
        is ExecutionOverlayEvent.Suspend -> ExecutionOverlayState.Suspended
        is ExecutionOverlayEvent.Cancel -> ExecutionOverlayState.Cancelled
        else -> state
    }
    ExecutionOverlayState.Suspended -> when (event) {
        is ExecutionOverlayEvent.Resume -> ExecutionOverlayState.Live
        is ExecutionOverlayEvent.Cancel -> ExecutionOverlayState.Cancelled
        else -> state
    }
    ExecutionOverlayState.Completed -> when (event) {
        is ExecutionOverlayEvent.Reset -> ExecutionOverlayState.Idle
        else -> state
    }
    ExecutionOverlayState.Failed -> when (event) {
        is ExecutionOverlayEvent.Reset -> ExecutionOverlayState.Idle
        is ExecutionOverlayEvent.Retry -> ExecutionOverlayState.Live
        else -> state
    }
    ExecutionOverlayState.Cancelled -> when (event) {
        is ExecutionOverlayEvent.Reset -> ExecutionOverlayState.Idle
        else -> state
    }
    ExecutionOverlayState.Replay -> when (event) {
        is ExecutionOverlayEvent.ReplayStep -> ExecutionOverlayState.Replay
        is ExecutionOverlayEvent.ReplayEnd -> ExecutionOverlayState.Idle
        else -> state
    }
}

// --- Types ---

data class ExecutionStep(
    val id: String,
    val label: String,
    val status: String // "active", "complete", "pending", "failed", "skipped"
)

// --- Helpers ---

private fun formatElapsedMs(ms: Long): String {
    val totalSeconds = (ms / 1000).toInt()
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return when {
        hours > 0 -> "${hours}h ${"%02d".format(minutes)}m ${"%02d".format(seconds)}s"
        minutes > 0 -> "${minutes}m ${"%02d".format(seconds)}s"
        else -> "${seconds}s"
    }
}

private fun statusIcon(status: String): String = when (status) {
    "complete" -> "\u2713"
    "active" -> "\u25CF"
    "failed" -> "\u2717"
    "skipped" -> "\u2014"
    else -> "\u25CB"
}

@Composable
fun ExecutionOverlay(
    status: String,
    modifier: Modifier = Modifier,
    activeStep: String? = null,
    startedAt: String? = null,
    endedAt: String? = null,
    mode: String = "live",
    showControls: Boolean = true,
    showElapsed: Boolean = true,
    steps: List<ExecutionStep> = emptyList(),
    errorMessage: String? = null,
    onSuspend: () -> Unit = {},
    onResume: () -> Unit = {},
    onCancel: () -> Unit = {},
    onRetry: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ExecutionOverlayState.Idle) }
    var elapsed by remember { mutableLongStateOf(0L) }

    // Auto-transition based on mode
    LaunchedEffect(mode, state) {
        if (mode == "replay" && state == ExecutionOverlayState.Idle) {
            state = executionOverlayReduce(state, ExecutionOverlayEvent.LoadReplay)
        }
    }

    // Auto-start based on status prop
    LaunchedEffect(status, state) {
        when (status) {
            "running" -> if (state == ExecutionOverlayState.Idle) state = executionOverlayReduce(state, ExecutionOverlayEvent.Start)
            "completed" -> if (state == ExecutionOverlayState.Live) state = executionOverlayReduce(state, ExecutionOverlayEvent.Complete)
            "failed" -> if (state == ExecutionOverlayState.Live) state = executionOverlayReduce(state, ExecutionOverlayEvent.Fail)
            "suspended" -> if (state == ExecutionOverlayState.Live) state = executionOverlayReduce(state, ExecutionOverlayEvent.Suspend)
            "cancelled" -> if (state == ExecutionOverlayState.Live || state == ExecutionOverlayState.Suspended) state = executionOverlayReduce(state, ExecutionOverlayEvent.Cancel)
        }
    }

    // Elapsed time ticker
    LaunchedEffect(state, startedAt) {
        if (state == ExecutionOverlayState.Live && startedAt != null) {
            val start = try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(startedAt)?.time ?: System.currentTimeMillis() } catch (_: Exception) { System.currentTimeMillis() }
            while (true) {
                elapsed = System.currentTimeMillis() - start
                delay(1000)
            }
        }
        if ((state == ExecutionOverlayState.Completed || state == ExecutionOverlayState.Failed || state == ExecutionOverlayState.Cancelled) && startedAt != null) {
            val start = try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(startedAt)?.time ?: System.currentTimeMillis() } catch (_: Exception) { System.currentTimeMillis() }
            val end = if (endedAt != null) {
                try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(endedAt)?.time ?: System.currentTimeMillis() } catch (_: Exception) { System.currentTimeMillis() }
            } else System.currentTimeMillis()
            elapsed = end - start
        }
    }

    Column(
        modifier = modifier.semantics { contentDescription = "Process execution: $status" }
    ) {
        // Step overlays
        steps.forEach { step ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.padding(vertical = 2.dp)
            ) {
                Text(statusIcon(step.status), fontSize = 14.sp)
                Text(step.label, fontSize = 13.sp, fontWeight = if (step.id == activeStep) FontWeight.Bold else FontWeight.Normal)
            }
        }

        // Status bar
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(vertical = 8.dp)
        ) {
            Text(status, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)

            if (showElapsed) {
                Text(formatElapsedMs(elapsed), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // Controls
        if (showControls) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (state == ExecutionOverlayState.Live) {
                    Button(onClick = {
                        state = executionOverlayReduce(state, ExecutionOverlayEvent.Suspend)
                        onSuspend()
                    }) { Text("Suspend") }
                }
                if (state == ExecutionOverlayState.Suspended) {
                    Button(onClick = {
                        state = executionOverlayReduce(state, ExecutionOverlayEvent.Resume)
                        onResume()
                    }) { Text("Resume") }
                }
                if (state == ExecutionOverlayState.Live || state == ExecutionOverlayState.Suspended) {
                    OutlinedButton(onClick = {
                        state = executionOverlayReduce(state, ExecutionOverlayEvent.Cancel)
                        onCancel()
                    }) { Text("Cancel") }
                }
                if (state == ExecutionOverlayState.Failed) {
                    Button(onClick = {
                        state = executionOverlayReduce(state, ExecutionOverlayEvent.Retry)
                        onRetry()
                    }) { Text("Retry") }
                }
            }
        }

        // Error banner
        if (state == ExecutionOverlayState.Failed) {
            Text(
                errorMessage ?: "Execution failed",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}
