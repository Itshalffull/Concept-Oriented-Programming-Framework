package com.clef.surface.widgets.concepts.governanceexecution

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

enum class TimelockCountdownState { Running, Warning, Critical, Expired, Executing, Completed, Paused }

sealed class TimelockCountdownEvent {
    object Tick : TimelockCountdownEvent()
    object WarningThreshold : TimelockCountdownEvent()
    object CriticalThreshold : TimelockCountdownEvent()
    object Expire : TimelockCountdownEvent()
    object Pause : TimelockCountdownEvent()
    object Resume : TimelockCountdownEvent()
    object Execute : TimelockCountdownEvent()
    object ExecuteComplete : TimelockCountdownEvent()
    object ExecuteError : TimelockCountdownEvent()
    object Reset : TimelockCountdownEvent()
    object Challenge : TimelockCountdownEvent()
}

fun timelockCountdownReduce(state: TimelockCountdownState, event: TimelockCountdownEvent): TimelockCountdownState = when (state) {
    TimelockCountdownState.Running -> when (event) {
        is TimelockCountdownEvent.Tick -> TimelockCountdownState.Running
        is TimelockCountdownEvent.WarningThreshold -> TimelockCountdownState.Warning
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        is TimelockCountdownEvent.Pause -> TimelockCountdownState.Paused
        else -> state
    }
    TimelockCountdownState.Warning -> when (event) {
        is TimelockCountdownEvent.Tick -> TimelockCountdownState.Warning
        is TimelockCountdownEvent.CriticalThreshold -> TimelockCountdownState.Critical
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        else -> state
    }
    TimelockCountdownState.Critical -> when (event) {
        is TimelockCountdownEvent.Tick -> TimelockCountdownState.Critical
        is TimelockCountdownEvent.Expire -> TimelockCountdownState.Expired
        else -> state
    }
    TimelockCountdownState.Expired -> when (event) {
        is TimelockCountdownEvent.Execute -> TimelockCountdownState.Executing
        is TimelockCountdownEvent.Reset -> TimelockCountdownState.Running
        else -> state
    }
    TimelockCountdownState.Executing -> when (event) {
        is TimelockCountdownEvent.ExecuteComplete -> TimelockCountdownState.Completed
        is TimelockCountdownEvent.ExecuteError -> TimelockCountdownState.Expired
        else -> state
    }
    TimelockCountdownState.Completed -> state
    TimelockCountdownState.Paused -> when (event) {
        is TimelockCountdownEvent.Resume -> TimelockCountdownState.Running
        else -> state
    }
}

// --- Helpers ---

data class TimeRemaining(
    val days: Int,
    val hours: Int,
    val minutes: Int,
    val seconds: Int,
    val totalMs: Long
)

private fun computeTimeRemaining(deadlineMs: Long, nowMs: Long): TimeRemaining {
    val totalMs = maxOf(0L, deadlineMs - nowMs)
    val totalSeconds = (totalMs / 1000).toInt()
    val days = totalSeconds / 86400
    val hours = (totalSeconds % 86400) / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return TimeRemaining(days, hours, minutes, seconds, totalMs)
}

private fun formatTimeRemaining(tr: TimeRemaining): String {
    if (tr.totalMs <= 0) return "00:00:00"
    return buildString {
        if (tr.days > 0) append("${tr.days}d ")
        append("%02d:%02d:%02d".format(tr.hours, tr.minutes, tr.seconds))
    }
}

@Composable
fun TimelockCountdown(
    deadlineMs: Long,
    modifier: Modifier = Modifier,
    warningThresholdMs: Long = 3600_000L,
    criticalThresholdMs: Long = 600_000L,
    phaseName: String = "Timelock delay",
    onExecute: () -> Unit = {},
    onChallenge: () -> Unit = {},
    onExpire: () -> Unit = {}
) {
    var state by remember { mutableStateOf(TimelockCountdownState.Running) }
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }

    val timeRemaining = remember(deadlineMs, nowMs) { computeTimeRemaining(deadlineMs, nowMs) }
    val totalDuration = remember(deadlineMs) { maxOf(1L, deadlineMs - System.currentTimeMillis()) }
    val progressPercent = remember(timeRemaining, totalDuration) {
        1f - (timeRemaining.totalMs.toFloat() / totalDuration).coerceIn(0f, 1f)
    }

    // Tick every second
    LaunchedEffect(state) {
        while (state in listOf(TimelockCountdownState.Running, TimelockCountdownState.Warning, TimelockCountdownState.Critical)) {
            delay(1000)
            nowMs = System.currentTimeMillis()
            val tr = computeTimeRemaining(deadlineMs, nowMs)

            if (tr.totalMs <= 0) {
                state = timelockCountdownReduce(state, TimelockCountdownEvent.Expire)
                onExpire()
            } else if (tr.totalMs <= criticalThresholdMs && state != TimelockCountdownState.Critical) {
                state = timelockCountdownReduce(state, TimelockCountdownEvent.CriticalThreshold)
            } else if (tr.totalMs <= warningThresholdMs && state == TimelockCountdownState.Running) {
                state = timelockCountdownReduce(state, TimelockCountdownEvent.WarningThreshold)
            }
        }
    }

    val timeColor = when (state) {
        TimelockCountdownState.Critical -> MaterialTheme.colorScheme.error
        TimelockCountdownState.Warning -> MaterialTheme.colorScheme.tertiary
        TimelockCountdownState.Expired -> MaterialTheme.colorScheme.error
        else -> MaterialTheme.colorScheme.onSurface
    }

    val phaseText = when (state) {
        TimelockCountdownState.Expired -> "Ready to execute"
        TimelockCountdownState.Executing -> "Executing..."
        TimelockCountdownState.Completed -> "Execution complete"
        TimelockCountdownState.Paused -> "Paused"
        else -> phaseName
    }

    Column(modifier = modifier.semantics { contentDescription = "Timelock countdown: $phaseText" }) {
        // Phase name
        Text(phaseText, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))

        // Countdown time
        Text(
            formatTimeRemaining(timeRemaining),
            fontSize = 32.sp,
            fontWeight = FontWeight.Bold,
            color = timeColor,
            modifier = Modifier.padding(horizontal = 12.dp)
        )

        // Progress bar
        LinearProgressIndicator(
            progress = { progressPercent },
            color = timeColor,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
        )

        // Action buttons
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            when (state) {
                TimelockCountdownState.Expired -> {
                    Button(onClick = {
                        state = timelockCountdownReduce(state, TimelockCountdownEvent.Execute)
                        onExecute()
                    }) { Text("Execute") }
                    OutlinedButton(onClick = {
                        state = timelockCountdownReduce(state, TimelockCountdownEvent.Challenge)
                        onChallenge()
                    }) { Text("Challenge") }
                }
                TimelockCountdownState.Executing -> {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    Text("Executing...", modifier = Modifier.align(Alignment.CenterVertically))
                }
                TimelockCountdownState.Completed -> {
                    Text("\u2713 Complete", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                else -> {
                    // Running/warning/critical: show challenge button
                    OutlinedButton(onClick = {
                        onChallenge()
                    }) { Text("Challenge") }
                }
            }
        }
    }
}
