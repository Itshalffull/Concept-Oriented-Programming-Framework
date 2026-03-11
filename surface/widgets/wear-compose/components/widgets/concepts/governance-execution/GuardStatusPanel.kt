package com.clef.surface.widgets.concepts.governanceexecution

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class GuardStatusPanelState { Idle, GuardSelected }

sealed class GuardStatusPanelEvent {
    data class SelectGuard(val guardName: String) : GuardStatusPanelEvent()
    object Deselect : GuardStatusPanelEvent()
}

fun guardStatusPanelReduce(
    state: GuardStatusPanelState,
    event: GuardStatusPanelEvent
): GuardStatusPanelState = when (state) {
    GuardStatusPanelState.Idle -> when (event) {
        is GuardStatusPanelEvent.SelectGuard -> GuardStatusPanelState.GuardSelected
        else -> state
    }
    GuardStatusPanelState.GuardSelected -> when (event) {
        is GuardStatusPanelEvent.Deselect -> GuardStatusPanelState.Idle
        is GuardStatusPanelEvent.SelectGuard -> GuardStatusPanelState.GuardSelected
    }
}

// --- Public types ---

enum class GuardStatus { Passing, Failing, Pending, Bypassed }

data class Guard(
    val id: String? = null,
    val name: String,
    val description: String,
    val status: GuardStatus,
    val lastChecked: String? = null
)

private val STATUS_ICONS = mapOf(
    GuardStatus.Passing to "\u2713",
    GuardStatus.Failing to "\u2717",
    GuardStatus.Pending to "\u23F3",
    GuardStatus.Bypassed to "\u2298"
)

private val STATUS_COLORS = mapOf(
    GuardStatus.Passing to Color(0xFF22C55E),
    GuardStatus.Failing to Color(0xFFEF4444),
    GuardStatus.Pending to Color(0xFFF59E0B),
    GuardStatus.Bypassed to Color(0xFF6B7280)
)

@Composable
fun GuardStatusPanel(
    guards: List<Guard>,
    executionStatus: String,
    modifier: Modifier = Modifier,
    onGuardSelect: (Guard) -> Unit = {}
) {
    var state by remember { mutableStateOf(GuardStatusPanelState.Idle) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val failing = guards.count { it.status == GuardStatus.Failing }
    val passing = guards.count { it.status == GuardStatus.Passing }
    val overallColor = when {
        failing > 0 -> Color(0xFFEF4444)
        guards.any { it.status == GuardStatus.Pending } -> Color(0xFFF59E0B)
        else -> Color(0xFF22C55E)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Guard status panel" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Guards $passing/${guards.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                executionStatus,
                style = MaterialTheme.typography.labelSmall,
                color = overallColor
            )
        }

        items(guards) { guard ->
            val icon = STATUS_ICONS[guard.status] ?: ""
            val color = STATUS_COLORS[guard.status] ?: Color.Gray
            val isSelected = selectedName == guard.name

            Chip(
                onClick = {
                    val next = if (isSelected) null else guard.name
                    selectedName = next
                    state = guardStatusPanelReduce(
                        state,
                        if (next != null) GuardStatusPanelEvent.SelectGuard(next)
                        else GuardStatusPanelEvent.Deselect
                    )
                    onGuardSelect(guard)
                },
                label = {
                    Text(
                        text = "$icon ${guard.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected) {
                    { Text(guard.description, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                } else null
            )
        }
    }
}
