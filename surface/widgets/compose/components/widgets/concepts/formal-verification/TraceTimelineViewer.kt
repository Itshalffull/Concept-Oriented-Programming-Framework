package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class TraceTimelineViewerState { Idle, Playing, CellSelected }

sealed class TraceTimelineViewerEvent {
    object Play : TraceTimelineViewerEvent()
    object StepForward : TraceTimelineViewerEvent()
    object StepBackward : TraceTimelineViewerEvent()
    object SelectCell : TraceTimelineViewerEvent()
    object Zoom : TraceTimelineViewerEvent()
    object Pause : TraceTimelineViewerEvent()
    object StepEnd : TraceTimelineViewerEvent()
    object Deselect : TraceTimelineViewerEvent()
}

fun traceTimelineViewerReduce(state: TraceTimelineViewerState, event: TraceTimelineViewerEvent): TraceTimelineViewerState = when (state) {
    TraceTimelineViewerState.Idle -> when (event) {
        is TraceTimelineViewerEvent.Play -> TraceTimelineViewerState.Playing
        is TraceTimelineViewerEvent.StepForward -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.StepBackward -> TraceTimelineViewerState.Idle
        is TraceTimelineViewerEvent.SelectCell -> TraceTimelineViewerState.CellSelected
        is TraceTimelineViewerEvent.Zoom -> TraceTimelineViewerState.Idle
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

// --- Types ---

data class TraceStep(
    val index: Int,
    val label: String,
    val state: Map<String, String>,
    val isError: Boolean = false,
    val timestamp: String? = null
)

data class SelectedCell(val step: Int, val variable: String)

@Composable
fun TraceTimelineViewer(
    steps: List<TraceStep>,
    modifier: Modifier = Modifier,
    variables: List<String>? = null,
    currentStep: Int? = null,
    playbackSpeed: Float = 1.0f,
    showChangesOnly: Boolean = false,
    zoom: Float = 1.0f,
    onStepChange: (Int) -> Unit = {}
) {
    var widgetState by remember { mutableStateOf(TraceTimelineViewerState.Idle) }
    var internalStep by remember { mutableIntStateOf(0) }
    val activeStep = currentStep ?: internalStep
    var selectedCell by remember { mutableStateOf<SelectedCell?>(null) }
    var focusedLane by remember { mutableIntStateOf(0) }

    // Derive variable names from steps if not provided
    val resolvedVariables = remember(variables, steps) {
        variables ?: steps.flatMap { it.state.keys }.distinct()
    }

    // Sync with controlled prop
    LaunchedEffect(currentStep) {
        if (currentStep != null) internalStep = currentStep
    }

    fun goToStep(idx: Int) {
        val clamped = idx.coerceIn(0, (steps.size - 1).coerceAtLeast(0))
        internalStep = clamped
        onStepChange(clamped)
    }

    fun didValueChange(stepIdx: Int, variable: String): Boolean {
        if (stepIdx == 0) return false
        val prev = steps.getOrNull(stepIdx - 1)?.state?.get(variable)
        val curr = steps.getOrNull(stepIdx)?.state?.get(variable)
        return prev != curr
    }

    // Playback timer
    LaunchedEffect(widgetState, playbackSpeed) {
        if (widgetState == TraceTimelineViewerState.Playing) {
            val intervalMs = maxOf(100L, (1000L / playbackSpeed).toLong())
            while (true) {
                delay(intervalMs)
                val next = internalStep + 1
                if (next >= steps.size) {
                    widgetState = traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.StepEnd)
                    break
                }
                internalStep = next
                onStepChange(next)
            }
        }
    }

    val currentStepData = steps.getOrNull(activeStep)
    val scrollState = rememberScrollState()

    Column(modifier = modifier.semantics { contentDescription = "Trace timeline" }) {
        // Time axis
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(scrollState).padding(start = 80.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            steps.forEach { step ->
                Text(
                    "${step.index}",
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace,
                    color = if (step.isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = if (step.index == activeStep) FontWeight.Bold else FontWeight.Normal,
                    modifier = Modifier.width((40 * zoom).dp)
                )
            }
        }

        HorizontalDivider()

        // Variable lanes
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(resolvedVariables) { laneIdx, variable ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .then(if (laneIdx == focusedLane) Modifier.background(MaterialTheme.colorScheme.surfaceVariant) else Modifier)
                ) {
                    // Lane label
                    Text(
                        variable,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.width(80.dp).padding(horizontal = 4.dp)
                    )

                    // Cells
                    Row(
                        modifier = Modifier.horizontalScroll(scrollState),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        steps.forEach { step ->
                            val value = step.state[variable] ?: ""
                            val changed = didValueChange(step.index, variable)
                            if (showChangesOnly && !changed && step.index != 0) return@forEach

                            val isCurrent = step.index == activeStep
                            val isSelected = selectedCell?.step == step.index && selectedCell?.variable == variable

                            Surface(
                                tonalElevation = if (isCurrent) 2.dp else 0.dp,
                                modifier = Modifier
                                    .width((40 * zoom).dp)
                                    .clickable {
                                        selectedCell = SelectedCell(step.index, variable)
                                        goToStep(step.index)
                                        widgetState = traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.SelectCell)
                                    }
                                    .then(
                                        if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary)
                                        else Modifier
                                    )
                                    .then(
                                        if (step.isError) Modifier.background(Color(0x20EF4444))
                                        else Modifier
                                    )
                            ) {
                                Text(
                                    value,
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = if (changed) FontWeight.Bold else FontWeight.Normal,
                                    color = if (step.isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(2.dp),
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
        }

        HorizontalDivider()

        // Playback controls
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(8.dp)
        ) {
            IconButton(
                onClick = { widgetState = traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.StepBackward); goToStep(activeStep - 1) },
                enabled = activeStep > 0
            ) { Text("\u00AB", fontSize = 16.sp) }

            IconButton(onClick = {
                widgetState = if (widgetState == TraceTimelineViewerState.Playing) {
                    traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.Pause)
                } else {
                    traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.Play)
                }
            }) {
                Text(if (widgetState == TraceTimelineViewerState.Playing) "\u23F8" else "\u25B6", fontSize = 16.sp)
            }

            IconButton(
                onClick = { widgetState = traceTimelineViewerReduce(widgetState, TraceTimelineViewerEvent.StepForward); goToStep(activeStep + 1) },
                enabled = activeStep < steps.size - 1
            ) { Text("\u00BB", fontSize = 16.sp) }

            Text(
                if (steps.isNotEmpty()) "${activeStep + 1} / ${steps.size}" else "0 / 0",
                fontSize = 13.sp
            )
        }

        // Detail panel when a cell is selected
        if (widgetState == TraceTimelineViewerState.CellSelected && currentStepData != null) {
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text(
                    "Step ${currentStepData.index}: ${currentStepData.label}" +
                        if (currentStepData.isError) " (error)" else "",
                    fontWeight = FontWeight.Bold,
                    color = if (currentStepData.isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                )
                currentStepData.timestamp?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                Spacer(Modifier.height(4.dp))
                currentStepData.state.forEach { (key, value) ->
                    val changed = didValueChange(activeStep, key)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(key, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                        Text(
                            value,
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace,
                            fontWeight = if (changed) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }
            }
        }
    }
}
