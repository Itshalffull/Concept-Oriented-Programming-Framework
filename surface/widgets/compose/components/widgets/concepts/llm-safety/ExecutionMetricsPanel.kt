package com.clef.surface.widgets.concepts.llmsafety

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class ExecutionMetricsPanelState { Idle, Updating }

sealed class ExecutionMetricsPanelEvent {
    object Update : ExecutionMetricsPanelEvent()
    object UpdateComplete : ExecutionMetricsPanelEvent()
}

fun executionMetricsPanelReduce(state: ExecutionMetricsPanelState, event: ExecutionMetricsPanelEvent): ExecutionMetricsPanelState = when (state) {
    ExecutionMetricsPanelState.Idle -> when (event) {
        is ExecutionMetricsPanelEvent.Update -> ExecutionMetricsPanelState.Updating
        else -> state
    }
    ExecutionMetricsPanelState.Updating -> when (event) {
        is ExecutionMetricsPanelEvent.UpdateComplete -> ExecutionMetricsPanelState.Idle
        else -> state
    }
}

// --- Helpers ---

private fun tokenGaugeColor(totalTokens: Int, tokenLimit: Int?): Color {
    if (tokenLimit == null || tokenLimit <= 0) return Color(0xFF16A34A)
    val pct = (totalTokens.toFloat() / tokenLimit) * 100f
    return when {
        pct >= 90 -> Color(0xFFDC2626)
        pct >= 70 -> Color(0xFFCA8A04)
        else -> Color(0xFF16A34A)
    }
}

private fun errorRateColor(rate: Float): Color = when {
    rate >= 5f -> Color(0xFFDC2626)
    rate >= 1f -> Color(0xFFCA8A04)
    else -> Color(0xFF16A34A)
}

@Composable
fun ExecutionMetricsPanel(
    totalTokens: Int,
    totalCost: Float,
    stepCount: Int,
    errorRate: Float,
    modifier: Modifier = Modifier,
    tokenLimit: Int? = null,
    showLatency: Boolean = true,
    compact: Boolean = false,
    latencyAvg: Float? = null,
    latencyP95: Float? = null
) {
    var state by remember { mutableStateOf(ExecutionMetricsPanelState.Idle) }

    // Track value changes for updating state
    val prevTokens = remember { mutableIntStateOf(totalTokens) }
    LaunchedEffect(totalTokens, totalCost, stepCount, errorRate) {
        if (prevTokens.intValue != totalTokens) {
            state = executionMetricsPanelReduce(state, ExecutionMetricsPanelEvent.Update)
            delay(300)
            state = executionMetricsPanelReduce(state, ExecutionMetricsPanelEvent.UpdateComplete)
            prevTokens.intValue = totalTokens
        }
    }

    val tokenPct = if (tokenLimit != null && tokenLimit > 0) {
        minOf((totalTokens.toFloat() / tokenLimit) * 100f, 100f)
    } else null
    val gaugeColor = tokenGaugeColor(totalTokens, tokenLimit)
    val errColor = errorRateColor(errorRate)

    Column(
        verticalArrangement = Arrangement.spacedBy(if (compact) 4.dp else 12.dp),
        modifier = modifier.semantics { contentDescription = "Execution metrics" }
    ) {
        // Step counter
        Text(
            "\uD83D\uDCCB $stepCount step${if (stepCount != 1) "s" else ""}",
            fontSize = 13.sp,
            modifier = Modifier.semantics { contentDescription = "Steps: $stepCount" }
        )

        // Token gauge
        Column(modifier = Modifier.semantics { contentDescription = "Tokens: $totalTokens" }) {
            Text(
                "${"%,d".format(totalTokens)}${if (tokenLimit != null) " / ${"%,d".format(tokenLimit)}" else ""} tokens",
                fontSize = 13.sp
            )
            if (tokenPct != null) {
                LinearProgressIndicator(
                    progress = { tokenPct / 100f },
                    modifier = Modifier.fillMaxWidth().height(6.dp).padding(top = 4.dp),
                    color = gaugeColor
                )
                Text("${"%.1f".format(tokenPct)}%", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // Cost display
        Text(
            "${"$%.2f".format(totalCost)}",
            fontSize = 13.sp,
            modifier = Modifier.semantics { contentDescription = "Cost: ${"$%.2f".format(totalCost)}" }
        )

        // Latency
        if (showLatency) {
            Text(
                if (latencyAvg != null && latencyP95 != null)
                    "avg ${"%.1f".format(latencyAvg)}s / p95 ${"%.1f".format(latencyP95)}s"
                else "No latency data",
                fontSize = 13.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Error rate
        Text(
            "${"%.1f".format(errorRate)}%",
            fontSize = 13.sp,
            color = errColor,
            modifier = Modifier.semantics { contentDescription = "Error rate: ${"%.1f".format(errorRate)}%" }
        )
    }
}
