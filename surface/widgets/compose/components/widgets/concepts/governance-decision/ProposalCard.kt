package com.clef.surface.widgets.concepts.governancedecision

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class ProposalCardState { Idle, Hovered, Focused, Navigating }

sealed class ProposalCardEvent {
    object Hover : ProposalCardEvent()
    object Unhover : ProposalCardEvent()
    object Focus : ProposalCardEvent()
    object Blur : ProposalCardEvent()
    object Click : ProposalCardEvent()
    object Enter : ProposalCardEvent()
    object NavigateComplete : ProposalCardEvent()
}

fun proposalCardReduce(state: ProposalCardState, event: ProposalCardEvent): ProposalCardState = when (state) {
    ProposalCardState.Idle -> when (event) {
        is ProposalCardEvent.Hover -> ProposalCardState.Hovered
        is ProposalCardEvent.Focus -> ProposalCardState.Focused
        is ProposalCardEvent.Click -> ProposalCardState.Navigating
        else -> state
    }
    ProposalCardState.Hovered -> when (event) {
        is ProposalCardEvent.Unhover -> ProposalCardState.Idle
        else -> state
    }
    ProposalCardState.Focused -> when (event) {
        is ProposalCardEvent.Blur -> ProposalCardState.Idle
        is ProposalCardEvent.Click -> ProposalCardState.Navigating
        is ProposalCardEvent.Enter -> ProposalCardState.Navigating
        else -> state
    }
    ProposalCardState.Navigating -> when (event) {
        is ProposalCardEvent.NavigateComplete -> ProposalCardState.Idle
        else -> state
    }
}

// --- Helpers ---

private fun truncate(text: String, max: Int): String =
    if (text.length <= max) text else text.take(max).trimEnd() + "\u2026"

private fun actionLabelForStatus(status: String): String = when (status) {
    "Active" -> "Vote"
    "Passed", "Approved" -> "Execute"
    "Draft" -> "Edit"
    else -> "View"
}

@Composable
fun ProposalCard(
    title: String,
    description: String,
    author: String,
    status: String,
    timestamp: String,
    modifier: Modifier = Modifier,
    variant: String = "full",
    showVoteBar: Boolean = true,
    showQuorum: Boolean = false,
    truncateDescription: Int = 120,
    onClick: () -> Unit = {},
    onNavigate: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ProposalCardState.Idle) }

    val truncatedDescription = remember(description, truncateDescription) {
        truncate(description, truncateDescription)
    }
    val actionLabel = remember(status) { actionLabelForStatus(status) }

    // Navigation side-effect
    LaunchedEffect(state) {
        if (state == ProposalCardState.Navigating) {
            onClick()
            onNavigate()
            state = proposalCardReduce(state, ProposalCardEvent.NavigateComplete)
        }
    }

    val isMinimal = variant == "minimal"
    val showDescription = !isMinimal
    val showProposer = !isMinimal
    val showAction = !isMinimal

    val statusColor = when (status) {
        "Active" -> MaterialTheme.colorScheme.primary
        "Passed", "Approved" -> MaterialTheme.colorScheme.tertiary
        "Rejected", "Cancelled" -> MaterialTheme.colorScheme.error
        "Draft" -> MaterialTheme.colorScheme.onSurfaceVariant
        else -> MaterialTheme.colorScheme.onSurface
    }

    OutlinedCard(
        modifier = modifier
            .fillMaxWidth()
            .clickable { state = proposalCardReduce(state, ProposalCardEvent.Click) }
            .semantics { contentDescription = "$status proposal: $title" }
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Status badge
            Surface(
                color = statusColor.copy(alpha = 0.15f),
                shape = MaterialTheme.shapes.small
            ) {
                Text(
                    status,
                    color = statusColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                )
            }

            Spacer(Modifier.height(8.dp))

            // Title
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            // Description
            if (showDescription) {
                Text(
                    truncatedDescription,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis
                )
            }

            // Proposer
            if (showProposer) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Text("By $author", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            // Vote bar slot (placeholder when Active)
            if (showVoteBar && status == "Active" && !isMinimal) {
                Spacer(Modifier.height(8.dp))
                // Vote bar widget can be composed here
            }

            // Quorum gauge slot
            if (showQuorum && variant == "full") {
                // Quorum gauge widget can be composed here
            }

            // Time remaining
            Text(
                timestamp,
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp)
            )

            // Action button
            if (showAction) {
                Button(
                    onClick = { state = proposalCardReduce(state, ProposalCardEvent.Click) },
                    modifier = Modifier.padding(top = 8.dp)
                ) {
                    Text(actionLabel)
                }
            }
        }
    }
}
