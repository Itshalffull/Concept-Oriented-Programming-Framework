package com.clef.surface.widgets.concepts.formalverification

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

// --- State machine ---

enum class VerificationStatusBadgeState { Idle, Animating }

sealed class VerificationStatusBadgeEvent {
    object StatusChange : VerificationStatusBadgeEvent()
    object AnimationEnd : VerificationStatusBadgeEvent()
}

fun verificationStatusBadgeReduce(
    state: VerificationStatusBadgeState,
    event: VerificationStatusBadgeEvent
): VerificationStatusBadgeState = when (state) {
    VerificationStatusBadgeState.Idle -> when (event) {
        is VerificationStatusBadgeEvent.StatusChange -> VerificationStatusBadgeState.Animating
        else -> state
    }
    VerificationStatusBadgeState.Animating -> when (event) {
        is VerificationStatusBadgeEvent.AnimationEnd -> VerificationStatusBadgeState.Idle
        else -> state
    }
}

// --- Public types ---

enum class VerificationStatus { Proved, Refuted, Unknown, Timeout, Running }

private val STATUS_ICONS = mapOf(
    VerificationStatus.Proved to "\u2713",
    VerificationStatus.Refuted to "\u2717",
    VerificationStatus.Unknown to "?",
    VerificationStatus.Timeout to "\u23F0",
    VerificationStatus.Running to "\u25B6"
)

private val STATUS_LABELS = mapOf(
    VerificationStatus.Proved to "Proved",
    VerificationStatus.Refuted to "Refuted",
    VerificationStatus.Unknown to "Unknown",
    VerificationStatus.Timeout to "Timeout",
    VerificationStatus.Running to "Running"
)

private val STATUS_COLORS = mapOf(
    VerificationStatus.Proved to Color(0xFF22C55E),
    VerificationStatus.Refuted to Color(0xFFEF4444),
    VerificationStatus.Unknown to Color(0xFF9CA3AF),
    VerificationStatus.Timeout to Color(0xFFF97316),
    VerificationStatus.Running to Color(0xFF3B82F6)
)

@Composable
fun VerificationStatusBadge(
    status: VerificationStatus,
    label: String,
    modifier: Modifier = Modifier,
    detail: String? = null
) {
    var state by remember { mutableStateOf(VerificationStatusBadgeState.Idle) }
    val listState = rememberScalingLazyListState()

    val icon = STATUS_ICONS[status] ?: "?"
    val statusLabel = STATUS_LABELS[status] ?: "Unknown"
    val color = STATUS_COLORS[status] ?: Color.Gray

    LaunchedEffect(status) {
        state = verificationStatusBadgeReduce(state, VerificationStatusBadgeEvent.StatusChange)
        kotlinx.coroutines.delay(300)
        state = verificationStatusBadgeReduce(state, VerificationStatusBadgeEvent.AnimationEnd)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "$label verification status: $statusLabel" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Card(
                onClick = {},
                modifier = Modifier.padding(8.dp)
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.fillMaxWidth().padding(8.dp)
                ) {
                    Text(
                        text = icon,
                        style = MaterialTheme.typography.displaySmall,
                        color = color
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = statusLabel,
                        style = MaterialTheme.typography.titleSmall,
                        color = color
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodySmall
                    )
                    detail?.let {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = it,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
