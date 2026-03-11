package com.clef.surface.widgets.concepts.governancedecision

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
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text
import androidx.wear.compose.material3.TitleCard

// --- State machine ---

enum class ProposalCardState { Idle, Navigating }

sealed class ProposalCardEvent {
    object Click : ProposalCardEvent()
    object NavigateComplete : ProposalCardEvent()
}

fun proposalCardReduce(
    state: ProposalCardState,
    event: ProposalCardEvent
): ProposalCardState = when (state) {
    ProposalCardState.Idle -> when (event) {
        is ProposalCardEvent.Click -> ProposalCardState.Navigating
        else -> state
    }
    ProposalCardState.Navigating -> when (event) {
        is ProposalCardEvent.NavigateComplete -> ProposalCardState.Idle
        else -> state
    }
}

// --- Public types ---

enum class ProposalStatus { Draft, Active, Passed, Rejected, Queued, Executed }

private val STATUS_ICONS = mapOf(
    ProposalStatus.Draft to "\u270E",
    ProposalStatus.Active to "\u25B6",
    ProposalStatus.Passed to "\u2713",
    ProposalStatus.Rejected to "\u2717",
    ProposalStatus.Queued to "\u23F3",
    ProposalStatus.Executed to "\u2714"
)

private val STATUS_COLORS = mapOf(
    ProposalStatus.Draft to Color(0xFF9CA3AF),
    ProposalStatus.Active to Color(0xFF3B82F6),
    ProposalStatus.Passed to Color(0xFF22C55E),
    ProposalStatus.Rejected to Color(0xFFEF4444),
    ProposalStatus.Queued to Color(0xFFF59E0B),
    ProposalStatus.Executed to Color(0xFF10B981)
)

@Composable
fun ProposalCard(
    title: String,
    description: String,
    status: ProposalStatus,
    modifier: Modifier = Modifier,
    author: String? = null,
    voteEndTime: String? = null,
    forVotes: Int = 0,
    againstVotes: Int = 0,
    onClick: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ProposalCardState.Idle) }
    val listState = rememberScalingLazyListState()

    val icon = STATUS_ICONS[status] ?: ""
    val color = STATUS_COLORS[status] ?: Color.Gray
    val total = forVotes + againstVotes
    val forPercent = if (total > 0) (forVotes.toFloat() / total * 100).toInt() else 0

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Proposal: $title" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            TitleCard(
                onClick = {
                    state = proposalCardReduce(state, ProposalCardEvent.Click)
                    onClick()
                },
                title = {
                    Text(
                        text = title,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleSmall
                    )
                }
            ) {
                Column {
                    Text(
                        text = "$icon ${status.name}",
                        color = color,
                        style = MaterialTheme.typography.labelSmall
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = description,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodySmall
                    )
                    if (total > 0) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            text = "For: $forPercent% ($forVotes/$total)",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    author?.let {
                        Text(
                            text = "By: $it",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}
