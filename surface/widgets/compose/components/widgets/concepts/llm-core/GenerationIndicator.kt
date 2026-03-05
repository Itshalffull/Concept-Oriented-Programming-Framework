package com.clef.surface.widgets.concepts.llmcore

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

enum class GenerationIndicatorState { Idle, Generating, Complete, Error }

sealed class GenerationIndicatorEvent {
    object Start : GenerationIndicatorEvent()
    object Token : GenerationIndicatorEvent()
    object Complete : GenerationIndicatorEvent()
    object Error : GenerationIndicatorEvent()
    object Reset : GenerationIndicatorEvent()
    object Retry : GenerationIndicatorEvent()
}

fun generationIndicatorReduce(state: GenerationIndicatorState, event: GenerationIndicatorEvent): GenerationIndicatorState = when (state) {
    GenerationIndicatorState.Idle -> when (event) {
        is GenerationIndicatorEvent.Start -> GenerationIndicatorState.Generating
        else -> state
    }
    GenerationIndicatorState.Generating -> when (event) {
        is GenerationIndicatorEvent.Token -> GenerationIndicatorState.Generating
        is GenerationIndicatorEvent.Complete -> GenerationIndicatorState.Complete
        is GenerationIndicatorEvent.Error -> GenerationIndicatorState.Error
        else -> state
    }
    GenerationIndicatorState.Complete -> when (event) {
        is GenerationIndicatorEvent.Reset -> GenerationIndicatorState.Idle
        is GenerationIndicatorEvent.Start -> GenerationIndicatorState.Generating
        else -> state
    }
    GenerationIndicatorState.Error -> when (event) {
        is GenerationIndicatorEvent.Reset -> GenerationIndicatorState.Idle
        is GenerationIndicatorEvent.Retry -> GenerationIndicatorState.Generating
        else -> state
    }
}

// --- Helpers ---

private fun formatElapsed(seconds: Int): String {
    if (seconds < 60) return "${seconds}s"
    val m = seconds / 60
    val s = seconds % 60
    return if (s > 0) "${m}m ${s}s" else "${m}m"
}

@Composable
fun GenerationIndicator(
    status: GenerationIndicatorState,
    modifier: Modifier = Modifier,
    model: String? = null,
    tokenCount: Int? = null,
    showTokens: Boolean = true,
    showModel: Boolean = true,
    showElapsed: Boolean = true,
    variant: String = "dots",
    onRetry: () -> Unit = {}
) {
    var state by remember { mutableStateOf(GenerationIndicatorState.Idle) }
    var elapsedSeconds by remember { mutableIntStateOf(0) }
    var finalElapsed by remember { mutableIntStateOf(0) }

    // Sync reducer state with status prop
    LaunchedEffect(status) {
        when (status) {
            GenerationIndicatorState.Generating -> {
                if (state == GenerationIndicatorState.Idle || state == GenerationIndicatorState.Complete || state == GenerationIndicatorState.Error) {
                    state = if (state == GenerationIndicatorState.Error) {
                        generationIndicatorReduce(state, GenerationIndicatorEvent.Retry)
                    } else {
                        generationIndicatorReduce(state, GenerationIndicatorEvent.Start)
                    }
                }
            }
            GenerationIndicatorState.Complete -> {
                if (state == GenerationIndicatorState.Generating) {
                    state = generationIndicatorReduce(state, GenerationIndicatorEvent.Complete)
                }
            }
            GenerationIndicatorState.Error -> {
                if (state == GenerationIndicatorState.Generating) {
                    state = generationIndicatorReduce(state, GenerationIndicatorEvent.Error)
                }
            }
            GenerationIndicatorState.Idle -> {
                if (state == GenerationIndicatorState.Complete || state == GenerationIndicatorState.Error) {
                    state = generationIndicatorReduce(state, GenerationIndicatorEvent.Reset)
                }
            }
        }
    }

    // Elapsed time timer
    LaunchedEffect(state) {
        when (state) {
            GenerationIndicatorState.Generating -> {
                elapsedSeconds = 0
                while (true) {
                    delay(1000)
                    elapsedSeconds++
                }
            }
            GenerationIndicatorState.Complete, GenerationIndicatorState.Error -> {
                finalElapsed = elapsedSeconds
            }
            GenerationIndicatorState.Idle -> {
                elapsedSeconds = 0
                finalElapsed = 0
            }
        }
    }

    val isGenerating = state == GenerationIndicatorState.Generating

    val statusText = when (state) {
        GenerationIndicatorState.Generating -> "Generating\u2026"
        GenerationIndicatorState.Complete -> "Complete"
        GenerationIndicatorState.Error -> "Error"
        else -> ""
    }

    val elapsedText = when (state) {
        GenerationIndicatorState.Generating -> formatElapsed(elapsedSeconds)
        GenerationIndicatorState.Complete, GenerationIndicatorState.Error -> formatElapsed(finalElapsed)
        else -> ""
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier.semantics { contentDescription = "Generation ${state.name.lowercase()}" }
    ) {
        // Spinner
        if (isGenerating) {
            when (variant) {
                "spinner" -> CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                "bar" -> LinearProgressIndicator(modifier = Modifier.width(48.dp).height(4.dp))
                else -> Text("\u2026", fontSize = 14.sp) // dots
            }
        }

        // Status text
        if (statusText.isNotEmpty()) {
            Text(statusText, fontSize = 13.sp)
        }

        // Model badge
        if (showModel && model != null) {
            Text(model, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        }

        // Token counter
        if (showTokens && tokenCount != null) {
            Text("$tokenCount tokens", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Elapsed time
        if (showElapsed && (state == GenerationIndicatorState.Generating || state == GenerationIndicatorState.Complete)) {
            Text(elapsedText, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Retry button
        if (state == GenerationIndicatorState.Error) {
            TextButton(onClick = {
                state = generationIndicatorReduce(state, GenerationIndicatorEvent.Retry)
                onRetry()
            }) {
                Text("Retry", fontSize = 12.sp)
            }
        }
    }
}
