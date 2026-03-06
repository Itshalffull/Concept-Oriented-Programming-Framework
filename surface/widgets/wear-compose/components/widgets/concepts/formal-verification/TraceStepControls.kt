package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay

// --- State machine ---

enum class TraceStepControlsState { Paused, Playing }

sealed class TraceStepControlsEvent {
    object Play : TraceStepControlsEvent()
    object Pause : TraceStepControlsEvent()
    object StepFwd : TraceStepControlsEvent()
    object StepBack : TraceStepControlsEvent()
    object ReachEnd : TraceStepControlsEvent()
}

fun traceStepControlsReduce(
    state: TraceStepControlsState,
    event: TraceStepControlsEvent
): TraceStepControlsState = when (state) {
    TraceStepControlsState.Paused -> when (event) {
        is TraceStepControlsEvent.Play -> TraceStepControlsState.Playing
        is TraceStepControlsEvent.StepFwd -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.StepBack -> TraceStepControlsState.Paused
        else -> state
    }
    TraceStepControlsState.Playing -> when (event) {
        is TraceStepControlsEvent.Pause -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.ReachEnd -> TraceStepControlsState.Paused
        else -> state
    }
}

@Composable
fun TraceStepControls(
    currentStep: Int,
    totalSteps: Int,
    playing: Boolean = false,
    modifier: Modifier = Modifier,
    onStepForward: () -> Unit = {},
    onStepBack: () -> Unit = {},
    onPlay: () -> Unit = {},
    onPause: () -> Unit = {},
    onFirst: () -> Unit = {},
    onLast: () -> Unit = {}
) {
    var state by remember { mutableStateOf(if (playing) TraceStepControlsState.Playing else TraceStepControlsState.Paused) }
    val listState = rememberScalingLazyListState()

    val atFirst = currentStep <= 0
    val atLast = currentStep >= totalSteps - 1
    val progressPercent = if (totalSteps > 0) ((currentStep + 1).toFloat() / totalSteps * 100).toInt() else 0

    LaunchedEffect(playing) {
        state = if (playing) TraceStepControlsState.Playing else TraceStepControlsState.Paused
    }

    // Auto-advance during playback
    LaunchedEffect(state) {
        if (state == TraceStepControlsState.Playing) {
            while (true) {
                delay(1000)
                if (atLast) {
                    state = traceStepControlsReduce(state, TraceStepControlsEvent.ReachEnd)
                    onPause()
                    break
                }
                onStepForward()
            }
        }
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Trace step controls" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Step ${currentStep + 1}/$totalSteps",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                "$progressPercent%",
                style = MaterialTheme.typography.bodySmall
            )
        }

        // Play/Pause button
        item {
            Button(
                onClick = {
                    if (state == TraceStepControlsState.Playing) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.Pause)
                        onPause()
                    } else {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.Play)
                        onPlay()
                    }
                },
                label = {
                    Text(if (state == TraceStepControlsState.Playing) "\u23F8 Pause" else "\u25B6 Play")
                }
            )
        }

        // Navigation buttons
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(vertical = 4.dp)
            ) {
                Button(
                    onClick = {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.StepBack)
                        onFirst()
                    },
                    label = { Text("\u23EE") }
                )
                Button(
                    onClick = {
                        if (!atFirst) {
                            state = traceStepControlsReduce(state, TraceStepControlsEvent.StepBack)
                            onStepBack()
                        }
                    },
                    label = { Text("\u25C0") }
                )
                Button(
                    onClick = {
                        if (!atLast) {
                            state = traceStepControlsReduce(state, TraceStepControlsEvent.StepFwd)
                            onStepForward()
                        }
                    },
                    label = { Text("\u25B6") }
                )
                Button(
                    onClick = {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.StepFwd)
                        onLast()
                    },
                    label = { Text("\u23ED") }
                )
            }
        }
    }
}
