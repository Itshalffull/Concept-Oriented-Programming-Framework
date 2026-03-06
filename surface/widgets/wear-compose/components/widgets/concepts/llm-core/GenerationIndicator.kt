package com.clef.surface.widgets.concepts.llmcore

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
import androidx.wear.compose.material3.CircularProgressIndicator
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class GenerationIndicatorState { Idle, Generating, Complete, Error }

sealed class GenerationIndicatorEvent {
    object Start : GenerationIndicatorEvent()
    object TokenReceived : GenerationIndicatorEvent()
    object Finish : GenerationIndicatorEvent()
    object Fail : GenerationIndicatorEvent()
    object Reset : GenerationIndicatorEvent()
}

fun generationIndicatorReduce(
    state: GenerationIndicatorState,
    event: GenerationIndicatorEvent
): GenerationIndicatorState = when (state) {
    GenerationIndicatorState.Idle -> when (event) {
        is GenerationIndicatorEvent.Start -> GenerationIndicatorState.Generating
        else -> state
    }
    GenerationIndicatorState.Generating -> when (event) {
        is GenerationIndicatorEvent.TokenReceived -> GenerationIndicatorState.Generating
        is GenerationIndicatorEvent.Finish -> GenerationIndicatorState.Complete
        is GenerationIndicatorEvent.Fail -> GenerationIndicatorState.Error
        else -> state
    }
    GenerationIndicatorState.Complete -> when (event) {
        is GenerationIndicatorEvent.Start -> GenerationIndicatorState.Generating
        is GenerationIndicatorEvent.Reset -> GenerationIndicatorState.Idle
        else -> state
    }
    GenerationIndicatorState.Error -> when (event) {
        is GenerationIndicatorEvent.Start -> GenerationIndicatorState.Generating
        is GenerationIndicatorEvent.Reset -> GenerationIndicatorState.Idle
        else -> state
    }
}

@Composable
fun GenerationIndicator(
    status: GenerationIndicatorState,
    modifier: Modifier = Modifier,
    tokenCount: Int? = null,
    modelName: String? = null,
    elapsedMs: Long? = null
) {
    var state by remember { mutableStateOf(status) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(status) { state = status }

    val statusLabel = when (state) {
        GenerationIndicatorState.Idle -> "Ready"
        GenerationIndicatorState.Generating -> "Generating..."
        GenerationIndicatorState.Complete -> "Complete"
        GenerationIndicatorState.Error -> "Error"
    }

    val statusColor = when (state) {
        GenerationIndicatorState.Idle -> MaterialTheme.colorScheme.onSurfaceVariant
        GenerationIndicatorState.Generating -> Color(0xFF3B82F6)
        GenerationIndicatorState.Complete -> Color(0xFF22C55E)
        GenerationIndicatorState.Error -> Color(0xFFEF4444)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Generation status: $statusLabel" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Card(onClick = {}) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(12.dp)
                ) {
                    if (state == GenerationIndicatorState.Generating) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                    }

                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.titleSmall,
                        color = statusColor
                    )

                    modelName?.let {
                        Spacer(Modifier.height(2.dp))
                        Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    tokenCount?.let {
                        Spacer(Modifier.height(2.dp))
                        Text("$it tokens", style = MaterialTheme.typography.labelSmall)
                    }

                    elapsedMs?.let {
                        Text("${it}ms", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
