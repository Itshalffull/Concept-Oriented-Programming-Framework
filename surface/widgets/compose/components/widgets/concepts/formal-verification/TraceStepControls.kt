package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class TraceStepControlsState { Paused, Playing }

sealed class TraceStepControlsEvent {
    object Play : TraceStepControlsEvent()
    object StepFwd : TraceStepControlsEvent()
    object StepBack : TraceStepControlsEvent()
    object JumpStart : TraceStepControlsEvent()
    object JumpEnd : TraceStepControlsEvent()
    object Pause : TraceStepControlsEvent()
    object ReachEnd : TraceStepControlsEvent()
}

fun traceStepControlsReduce(state: TraceStepControlsState, event: TraceStepControlsEvent): TraceStepControlsState = when (state) {
    TraceStepControlsState.Paused -> when (event) {
        is TraceStepControlsEvent.Play -> TraceStepControlsState.Playing
        is TraceStepControlsEvent.StepFwd -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.StepBack -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.JumpStart -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.JumpEnd -> TraceStepControlsState.Paused
        else -> state
    }
    TraceStepControlsState.Playing -> when (event) {
        is TraceStepControlsEvent.Pause -> TraceStepControlsState.Paused
        is TraceStepControlsEvent.ReachEnd -> TraceStepControlsState.Paused
        else -> state
    }
}

private val SPEED_OPTIONS = listOf(1, 2, 4)

@Composable
fun TraceStepControls(
    currentStep: Int,
    totalSteps: Int,
    playing: Boolean,
    modifier: Modifier = Modifier,
    speed: Int = 1,
    showSpeed: Boolean = true,
    onStepForward: () -> Unit = {},
    onStepBack: () -> Unit = {},
    onPlay: () -> Unit = {},
    onPause: () -> Unit = {},
    onSeek: (Int) -> Unit = {},
    onFirst: () -> Unit = {},
    onLast: () -> Unit = {},
    onSpeedChange: (Int) -> Unit = {}
) {
    var state by remember { mutableStateOf(if (playing) TraceStepControlsState.Playing else TraceStepControlsState.Paused) }

    val atFirst = currentStep <= 0
    val atLast = currentStep >= totalSteps - 1
    val progressPercent = if (totalSteps > 0) ((currentStep + 1).toFloat() / totalSteps) else 0f

    // Sync with external playing prop
    LaunchedEffect(playing) {
        state = if (playing) TraceStepControlsState.Playing else TraceStepControlsState.Paused
    }

    // Auto-advance during playback
    LaunchedEffect(state, speed) {
        if (state == TraceStepControlsState.Playing) {
            while (true) {
                delay((1000L / speed))
                onStepForward()
            }
        }
    }

    // Auto-pause at end
    LaunchedEffect(currentStep, atLast, state) {
        if (state == TraceStepControlsState.Playing && atLast) {
            state = traceStepControlsReduce(state, TraceStepControlsEvent.ReachEnd)
            onPause()
        }
    }

    Column(modifier = modifier.semantics { contentDescription = "Trace step controls" }) {
        // Transport controls
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
        ) {
            // Jump to start
            IconButton(
                onClick = {
                    if (!atFirst) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.JumpStart)
                        onFirst()
                    }
                },
                enabled = !atFirst
            ) {
                Text("\u25C4\u2502", fontSize = 16.sp)
            }

            // Step backward
            IconButton(
                onClick = {
                    if (!atFirst) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.StepBack)
                        onStepBack()
                    }
                },
                enabled = !atFirst
            ) {
                Text("\u25C4", fontSize = 16.sp)
            }

            // Play/Pause
            IconButton(
                onClick = {
                    if (state == TraceStepControlsState.Playing) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.Pause)
                        onPause()
                    } else {
                        if (!atLast) {
                            state = traceStepControlsReduce(state, TraceStepControlsEvent.Play)
                            onPlay()
                        }
                    }
                }
            ) {
                Text(if (state == TraceStepControlsState.Playing) "\u23F8" else "\u25B6", fontSize = 16.sp)
            }

            // Step forward
            IconButton(
                onClick = {
                    if (!atLast) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.StepFwd)
                        onStepForward()
                    }
                },
                enabled = !atLast
            ) {
                Text("\u25BA", fontSize = 16.sp)
            }

            // Jump to end
            IconButton(
                onClick = {
                    if (!atLast) {
                        state = traceStepControlsReduce(state, TraceStepControlsEvent.JumpEnd)
                        onLast()
                    }
                },
                enabled = !atLast
            ) {
                Text("\u2502\u25BA", fontSize = 16.sp)
            }
        }

        // Step counter
        Text(
            "Step ${currentStep + 1} of $totalSteps",
            fontSize = 13.sp,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
        )

        // Progress bar
        LinearProgressIndicator(
            progress = { progressPercent },
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp)
        )

        // Speed control
        if (showSpeed) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                SPEED_OPTIONS.forEach { s ->
                    FilterChip(
                        selected = s == speed,
                        onClick = { onSpeedChange(s) },
                        label = { Text("${s}x", fontSize = 12.sp) }
                    )
                }
            }
        }
    }
}
