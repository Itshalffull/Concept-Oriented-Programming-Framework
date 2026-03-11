package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import kotlinx.coroutines.delay

// --- State machine ---

enum class TraceTimelineViewerState { Idle, Playing, CellSelected }

sealed class TraceTimelineViewerEvent {
    object Play : TraceTimelineViewerEvent()
    object Pause : TraceTimelineViewerEvent()
    object StepForward : TraceTimelineViewerEvent()
    object StepBackward : TraceTimelineViewerEvent()
    data class SelectCell(val variable: String) : TraceTimelineViewerEvent()
    object Deselect : TraceTimelineViewerEvent()
    object StepEnd : TraceTimelineViewerEvent()
}

fun traceTimelineViewerReduce(
    state: TraceTimelineViewerState,
    event: TraceTimelineViewerEvent
): TraceTimelineViewerState = when (state) {
    TraceTimelineViewerState.Idle -> when (event) {
        is TraceTimelineViewerEvent.Play -> TraceTimelineViewerState.Playing
        is TraceTimelineViewerEvent.StepForward -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.StepBackward -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.SelectCell -> TraceTimelineViewerState.CellSelected
        else -> state
    }
    TraceTimelineViewerState.Playing -> when (event) {
        is TraceTimelineViewerEvent.Pause -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.StepEnd -> TraceTimelineViewerState.Idle
        else -> state
    }
    TraceTimelineViewerState.CellSelected -> when (event) {
        is TraceTimelineViewerEvent.Deselect -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.SelectCell -> TraceTimelineViewerState.CellSelected
        else -> state
    }
}

// --- Public types ---

data class TraceStep(
    val index: Int,
    val label: String,
    val state: Map<String, String>,
    val isError: Boolean = false,
    val timestamp: String? = null
)

@Composable
fun TraceTimelineViewer(
    steps: List<TraceStep>,
    modifier: Modifier = Modifier,
    currentStep: Int = 0,
    onStepChange: (Int) -> Unit = {}
) {
    var widgetState by remember { mutableStateOf(TraceTimelineViewerState.Idle) }
    var activeStep by remember { mutableStateOf(currentStep) }
    var selectedVariable by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(currentStep) { activeStep = currentStep }

    val variables = remember(steps) {
        val keys = mutableSetOf<String>()
        steps.forEach { keys.addAll(it.state.keys) }
        keys.toList()
    }

    val currentStepData = steps.getOrNull(activeStep)

    // Auto-advance during playback
    LaunchedEffect(widgetState) {
        if (widgetState == TraceTimelineViewerState.Playing) {
            while (true) {
                delay(1000)
                if (activeStep >= steps.size - 1) {
                    widgetState = traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.StepEnd)
                    break
                }
                activeStep++
                onStepChange(activeStep)
            }
        }
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Trace timeline viewer" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Step ${activeStep + 1}/${steps.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        currentStepData?.let { step ->
            item {
                Text(
                    step.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (step.isError) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurface
                )
            }
        }

        // Play/Pause
        item {
            Button(
                onClick = {
                    widgetState = if (widgetState == TraceTimelineViewerState.Playing) {
                        traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.Pause)
                    } else {
                        traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.Play)
                    }
                },
                label = {
                    Text(if (widgetState == TraceTimelineViewerState.Playing) "\u23F8 Pause" else "\u25B6 Play")
                }
            )
        }

        // Step navigation
        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        if (activeStep > 0) {
                            activeStep--
                            onStepChange(activeStep)
                        }
                    },
                    label = { Text("\u25C0") }
                )
                Button(
                    onClick = {
                        if (activeStep < steps.size - 1) {
                            activeStep++
                            onStepChange(activeStep)
                        }
                    },
                    label = { Text("\u25B6") }
                )
            }
        }

        // Variable values at current step
        currentStepData?.let { step ->
            items(variables) { variable ->
                val value = step.state[variable] ?: "-"
                val isSelected = selectedVariable == variable

                Chip(
                    onClick = {
                        selectedVariable = if (isSelected) null else variable
                        widgetState = traceTimelineViewerReduce(
                            widgetState,
                            if (isSelected) TraceTimelineViewerEvent.Deselect
                            else TraceTimelineViewerEvent.SelectCell(variable)
                        )
                    },
                    label = {
                        Text(
                            text = "$variable = $value",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                )
            }
        }
    }
}
