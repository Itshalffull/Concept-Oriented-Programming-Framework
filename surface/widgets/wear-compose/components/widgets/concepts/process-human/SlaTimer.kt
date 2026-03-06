package com.clef.surface.widgets.concepts.processhuman

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
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay

// --- State machine ---

enum class SlaTimerState { OnTrack, Warning, Critical, Breached, Paused }

sealed class SlaTimerEvent {
    object Tick : SlaTimerEvent()
    object WarnThreshold : SlaTimerEvent()
    object CriticalThreshold : SlaTimerEvent()
    object Breach : SlaTimerEvent()
    object Pause : SlaTimerEvent()
    object Resume : SlaTimerEvent()
}

fun slaTimerReduce(
    state: SlaTimerState,
    event: SlaTimerEvent
): SlaTimerState = when (state) {
    SlaTimerState.OnTrack -> when (event) {
        is SlaTimerEvent.WarnThreshold -> SlaTimerState.Warning
        is SlaTimerEvent.CriticalThreshold -> SlaTimerState.Critical
        is SlaTimerEvent.Breach -> SlaTimerState.Breached
        is SlaTimerEvent.Pause -> SlaTimerState.Paused
        else -> state
    }
    SlaTimerState.Warning -> when (event) {
        is SlaTimerEvent.CriticalThreshold -> SlaTimerState.Critical
        is SlaTimerEvent.Breach -> SlaTimerState.Breached
        else -> state
    }
    SlaTimerState.Critical -> when (event) {
        is SlaTimerEvent.Breach -> SlaTimerState.Breached
        else -> state
    }
    SlaTimerState.Breached -> state
    SlaTimerState.Paused -> when (event) {
        is SlaTimerEvent.Resume -> SlaTimerState.OnTrack
        else -> state
    }
}

private fun formatRemaining(totalMs: Long): String {
    if (totalMs <= 0) return "Breached"
    val totalSeconds = totalMs / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    val parts = mutableListOf<String>()
    if (hours > 0) parts.add("${hours}h")
    if (minutes > 0) parts.add("${minutes}m")
    parts.add("${seconds}s")
    return parts.joinToString(" ")
}

@Composable
fun SlaTimer(
    dueAt: String,
    slaStatus: String,
    modifier: Modifier = Modifier,
    label: String = "SLA",
    warningThreshold: Float = 0.75f,
    criticalThreshold: Float = 0.9f
) {
    val dueMs = remember(dueAt) {
        try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(dueAt)?.time ?: 0L }
        catch (_: Exception) { 0L }
    }

    var remainingMs by remember { mutableStateOf(maxOf(0L, dueMs - System.currentTimeMillis())) }

    var state by remember {
        mutableStateOf(
            when (slaStatus) {
                "warning" -> SlaTimerState.Warning
                "critical" -> SlaTimerState.Critical
                "breached" -> SlaTimerState.Breached
                "paused" -> SlaTimerState.Paused
                else -> SlaTimerState.OnTrack
            }
        )
    }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(Unit) {
        while (true) {
            delay(1000)
            remainingMs = maxOf(0L, dueMs - System.currentTimeMillis())
            if (remainingMs <= 0L && state != SlaTimerState.Breached) {
                state = slaTimerReduce(state, SlaTimerEvent.Breach)
            }
        }
    }

    val color = when (state) {
        SlaTimerState.OnTrack -> Color(0xFF22C55E)
        SlaTimerState.Warning -> Color(0xFFF59E0B)
        SlaTimerState.Critical -> Color(0xFFEF4444)
        SlaTimerState.Breached -> Color(0xFFDC2626)
        SlaTimerState.Paused -> Color(0xFF9CA3AF)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "SLA timer: $label" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Card(onClick = {}) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(12.dp)
                ) {
                    Text(
                        text = label,
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
                        text = state.name.replace("([A-Z])".toRegex(), " $1").trim(),
                        style = MaterialTheme.typography.labelSmall,
                        color = color
                    )
                }
            }
        }
    }
}
