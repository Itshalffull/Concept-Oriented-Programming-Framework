package com.clef.surface.widgets.concepts.processhuman

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class SlaTimerState { OnTrack, Warning, Critical, Breached, Paused }

sealed class SlaTimerEvent {
    object Tick : SlaTimerEvent()
    object WarningThreshold : SlaTimerEvent()
    object Pause : SlaTimerEvent()
    object CriticalThreshold : SlaTimerEvent()
    object Breach : SlaTimerEvent()
    object Resume : SlaTimerEvent()
}

fun slaTimerReduce(state: SlaTimerState, event: SlaTimerEvent): SlaTimerState = when (state) {
    SlaTimerState.OnTrack -> when (event) {
        is SlaTimerEvent.Tick -> SlaTimerState.OnTrack
        is SlaTimerEvent.WarningThreshold -> SlaTimerState.Warning
        is SlaTimerEvent.Pause -> SlaTimerState.Paused
        else -> state
    }
    SlaTimerState.Warning -> when (event) {
        is SlaTimerEvent.Tick -> SlaTimerState.Warning
        is SlaTimerEvent.CriticalThreshold -> SlaTimerState.Critical
        is SlaTimerEvent.Pause -> SlaTimerState.Paused
        else -> state
    }
    SlaTimerState.Critical -> when (event) {
        is SlaTimerEvent.Tick -> SlaTimerState.Critical
        is SlaTimerEvent.Breach -> SlaTimerState.Breached
        is SlaTimerEvent.Pause -> SlaTimerState.Paused
        else -> state
    }
    SlaTimerState.Breached -> when (event) {
        is SlaTimerEvent.Tick -> SlaTimerState.Breached
        else -> state
    }
    SlaTimerState.Paused -> when (event) {
        is SlaTimerEvent.Resume -> SlaTimerState.OnTrack
        else -> state
    }
}

// --- Helpers ---

private fun formatCountdown(ms: Long): String {
    if (ms <= 0) return "00:00:00"
    val totalSeconds = (ms / 1000).toInt()
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return "${"%02d".format(h)}:${"%02d".format(m)}:${"%02d".format(s)}"
}

private fun formatElapsed(ms: Long): String {
    if (ms <= 0) return "0s"
    val totalSeconds = (ms / 1000).toInt()
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return when {
        h > 0 -> "${h}h ${m}m ${s}s"
        m > 0 -> "${m}m ${s}s"
        else -> "${s}s"
    }
}

private val PHASE_LABELS = mapOf(
    SlaTimerState.OnTrack to "On Track",
    SlaTimerState.Warning to "Warning",
    SlaTimerState.Critical to "Critical",
    SlaTimerState.Breached to "Breached",
    SlaTimerState.Paused to "Paused"
)

private val PHASE_COLORS = mapOf(
    SlaTimerState.OnTrack to Color(0xFF16A34A),
    SlaTimerState.Warning to Color(0xFFCA8A04),
    SlaTimerState.Critical to Color(0xFFEA580C),
    SlaTimerState.Breached to Color(0xFFDC2626),
    SlaTimerState.Paused to Color(0xFF6B7280)
)

@Composable
fun SlaTimer(
    dueAt: String,
    status: String,
    modifier: Modifier = Modifier,
    warningThreshold: Float = 0.7f,
    criticalThreshold: Float = 0.9f,
    showElapsed: Boolean = true,
    startedAt: String? = null,
    onBreach: () -> Unit = {},
    onWarning: () -> Unit = {},
    onCritical: () -> Unit = {}
) {
    var state by remember { mutableStateOf(SlaTimerState.OnTrack) }
    var remaining by remember { mutableLongStateOf(0L) }
    var elapsed by remember { mutableLongStateOf(0L) }
    var progress by remember { mutableFloatStateOf(0f) }
    val breached = remember { mutableStateOf(false) }
    val warningFired = remember { mutableStateOf(false) }
    val criticalFired = remember { mutableStateOf(false) }

    val dueTime = remember(dueAt) {
        try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(dueAt)?.time ?: System.currentTimeMillis() }
        catch (_: Exception) { System.currentTimeMillis() }
    }
    val startTime = remember(startedAt) {
        if (startedAt != null) try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(startedAt)?.time ?: System.currentTimeMillis() }
        catch (_: Exception) { System.currentTimeMillis() }
        else System.currentTimeMillis()
    }
    val totalDuration = dueTime - startTime

    // Tick effect
    LaunchedEffect(state, dueTime, startTime) {
        if (state == SlaTimerState.Paused) return@LaunchedEffect
        while (true) {
            val now = System.currentTimeMillis()
            val rem = maxOf(0L, dueTime - now)
            val elap = now - startTime
            val prog = if (totalDuration > 0) minOf(1f, elap.toFloat() / totalDuration) else 1f

            remaining = rem
            elapsed = elap
            progress = prog

            state = slaTimerReduce(state, SlaTimerEvent.Tick)

            if (rem <= 0L && !breached.value) {
                breached.value = true
                state = slaTimerReduce(state, SlaTimerEvent.Breach)
                onBreach()
            } else if (prog >= criticalThreshold && !criticalFired.value && rem > 0) {
                criticalFired.value = true
                state = slaTimerReduce(state, SlaTimerEvent.CriticalThreshold)
                onCritical()
            } else if (prog >= warningThreshold && !warningFired.value && rem > 0) {
                warningFired.value = true
                state = slaTimerReduce(state, SlaTimerEvent.WarningThreshold)
                onWarning()
            }

            delay(1000)
        }
    }

    val phaseColor = PHASE_COLORS[state] ?: Color.Gray
    val progressPercent = (progress * 100).toInt()

    Column(modifier = modifier.semantics { contentDescription = "SLA timer: ${PHASE_LABELS[state]}" }) {
        // Countdown
        Text(
            if (state == SlaTimerState.Breached) "BREACHED" else formatCountdown(remaining),
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            color = phaseColor
        )

        // Phase label
        Text(
            PHASE_LABELS[state] ?: "",
            fontSize = 13.sp,
            color = phaseColor,
            modifier = Modifier.padding(top = 4.dp)
        )

        // Progress bar
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(8.dp).padding(top = 8.dp),
            color = phaseColor
        )

        // Elapsed time
        if (showElapsed) {
            Text(
                "Elapsed: ${formatElapsed(elapsed)}",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        // Pause/Resume
        if (state != SlaTimerState.Breached) {
            TextButton(
                onClick = {
                    state = if (state == SlaTimerState.Paused) slaTimerReduce(state, SlaTimerEvent.Resume)
                    else slaTimerReduce(state, SlaTimerEvent.Pause)
                },
                modifier = Modifier.padding(top = 4.dp)
            ) {
                Text(if (state == SlaTimerState.Paused) "Resume" else "Pause", fontSize = 13.sp)
            }
        }
    }
}
