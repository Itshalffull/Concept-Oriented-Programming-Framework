package com.clef.surface.widgets.concepts.governanceexecution

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay
import java.util.Date

// --- State machine ---

enum class TimelockCountdownState { Running, Warning, Critical, Expired, Executing, Completed, Paused }

sealed class TimelockCountdownEvent {
    object Tick : TimelockCountdownEvent()
    object Expire : TimelockCountdownEvent()
    object Execute : TimelockCountdownEvent()
    object Complete : TimelockCountdownEvent()
    object Pause : TimelockCountdownEvent()
    object Resume : TimelockCountdownEvent()
}

fun timelockCountdownReduce(
    state: TimelockCountdownState,
    event: TimelockCountdownEvent
): TimelockCountdownState = when (state) {
    TimelockCountdownState.Running -> when (event) {
        is TimelockCountdownEvent.Tick -> TimelockCountdownState.Running
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        is TimelockCountdownEvent.Pause -> TimelockCountdownState.Paused
        else -> state
    }
    TimelockCountdownState.Warning -> when (event) {
        is TimelockCountdownEvent.Tick -> TimelockCountdownState.Warning
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        else -> state
    }
    TimelockCountdownState.Critical -> when (event) {
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        else -> state
    }
    TimelockCountdownState.Expired -> when (event) {
        is TimelockCountdownEvent.Execute -> TimelockCountdownState.Executing
        else -> state
    }
    TimelockCountdownState.Executing -> when (event) {
        is TimelockCountdownEvent.Complete -> TimelockCountdownState.Completed
        else -> state
    }
    TimelockCountdownState.Completed -> state
    TimelockCountdownState.Paused -> when (event) {
        is TimelockCountdownEvent.Resume -> TimelockCountdownState.Running
        else -> state
    }
}

private fun formatRemaining(totalMs: Long): String {
    if (totalMs <= 0) return "0s"
    val totalSeconds = totalMs / 1000
    val days = totalSeconds / 86400
    val hours = (totalSeconds % 86400) / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    val parts = mutableListOf<String>()
    if (days > 0) parts.add("${days}d")
    if (hours > 0) parts.add("${hours}h")
    if (minutes > 0) parts.add("${minutes}m")
    parts.add("${seconds}s")
    return parts.joinToString(" ")
}

@Composable
fun TimelockCountdown(
    phase: String,
    deadline: String,
    elapsed: Int,
    total: Int,
    modifier: Modifier = Modifier,
    warningThreshold: Float = 0.8f,
    criticalThreshold: Float = 0.95f,
    onExecute: () -> Unit = {},
    onChallenge: () -> Unit = {}
) {
    val deadlineMs = remember(deadline) {
        try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(deadline)?.time ?: 0L }
        catch (_: Exception) { 0L }
    }

    var remainingMs by remember { mutableStateOf(maxOf(0L, deadlineMs - System.currentTimeMillis())) }
    val progress = if (total > 0) elapsed.toFloat() / total else 0f

    var state by remember {
        mutableStateOf(
            when {
                progress >= criticalThreshold -> TimelockCountdownState.Critical
                progress >= warningThreshold -> TimelockCountdownState.Warning
                else -> TimelockCountdownState.Running
            }
        )
    }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            remainingMs = maxOf(0L, deadlineMs - System.currentTimeMillis())
            if (remainingMs <= 0L) {
                state = timelockCountdownReduce(state, TimelockCountdownEvent.Expire)
                break
            }
        }
    }

    val color = when (state) {
        TimelockCountdownState.Running -> Color(0xFF3B82F6)
        TimelockCountdownState.Warning -> Color(0xFFF59E0B)
        TimelockCountdownState.Critical -> Color(0xFFEF4444)
        TimelockCountdownState.Expired -> Color(0xFFEF4444)
        TimelockCountdownState.Executing -> Color(0xFF8B5CF6)
        TimelockCountdownState.Completed -> Color(0xFF22C55E)
        TimelockCountdownState.Paused -> Color(0xFF9CA3AF)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Timelock countdown: $phase" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Card(onClick = {}) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(8.dp)
                ) {
                    Text(
                        text = phase,
                        style = MaterialTheme.typography.titleSmall
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = formatRemaining(remainingMs),
                        style = MaterialTheme.typography.displaySmall,
                        color = color
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "${(progress * 100).toInt()}% elapsed",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        if (state == TimelockCountdownState.Expired) {
            item {
                Button(
                    onClick = {
                        state = timelockCountdownReduce(state, TimelockCountdownEvent.Execute)
                        onExecute()
                    },
                    label = { Text("Execute") }
                )
            }
        }

        item {
            Button(
                onClick = { onChallenge() },
                label = { Text("Challenge") }
            )
        }
    }
}
