package com.clef.surface.widgets.concepts.processhuman

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
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ApprovalStepperState { Viewing, StepFocused, Acting }

sealed class ApprovalStepperEvent {
    data class FocusStep(val stepId: String) : ApprovalStepperEvent()
    object Unfocus : ApprovalStepperEvent()
    object Act : ApprovalStepperEvent()
    object ActionComplete : ApprovalStepperEvent()
}

fun approvalStepperReduce(
    state: ApprovalStepperState,
    event: ApprovalStepperEvent
): ApprovalStepperState = when (state) {
    ApprovalStepperState.Viewing -> when (event) {
        is ApprovalStepperEvent.FocusStep -> ApprovalStepperState.StepFocused
        else -> state
    }
    ApprovalStepperState.StepFocused -> when (event) {
        is ApprovalStepperEvent.Unfocus -> ApprovalStepperState.Viewing
        is ApprovalStepperEvent.Act -> ApprovalStepperState.Acting
        is ApprovalStepperEvent.FocusStep -> ApprovalStepperState.StepFocused
        else -> state
    }
    ApprovalStepperState.Acting -> when (event) {
        is ApprovalStepperEvent.ActionComplete -> ApprovalStepperState.Viewing
        else -> state
    }
}

// --- Public types ---

data class ApprovalStep(
    val id: String,
    val label: String,
    val approver: String? = null,
    val status: String, // pending, approved, rejected, skipped, active
    val timestamp: String? = null
)

private val STATUS_ICONS = mapOf(
    "pending" to "\u25CB",
    "approved" to "\u2713",
    "rejected" to "\u2717",
    "skipped" to "\u2298",
    "active" to "\u25B6"
)

private val STATUS_COLORS = mapOf(
    "pending" to Color(0xFF9CA3AF),
    "approved" to Color(0xFF22C55E),
    "rejected" to Color(0xFFEF4444),
    "skipped" to Color(0xFF6B7280),
    "active" to Color(0xFF3B82F6)
)

@Composable
fun ApprovalStepper(
    steps: List<ApprovalStep>,
    modifier: Modifier = Modifier,
    overallStatus: String = "pending",
    onApprove: (String) -> Unit = {},
    onReject: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(ApprovalStepperState.Viewing) }
    var focusedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val approved = steps.count { it.status == "approved" }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Approval stepper" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Approvals $approved/${steps.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(steps) { step ->
            val icon = STATUS_ICONS[step.status] ?: "\u25CB"
            val color = STATUS_COLORS[step.status] ?: Color.Gray
            val isFocused = focusedId == step.id

            Chip(
                onClick = {
                    val nextId = if (isFocused) null else step.id
                    focusedId = nextId
                    state = approvalStepperReduce(
                        state,
                        if (nextId != null) ApprovalStepperEvent.FocusStep(nextId)
                        else ApprovalStepperEvent.Unfocus
                    )
                },
                label = {
                    Text(
                        text = "$icon ${step.label}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isFocused) {
                    {
                        Column {
                            step.approver?.let { Text("Approver: $it", style = MaterialTheme.typography.labelSmall) }
                            step.timestamp?.let { Text(it, style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                } else {
                    step.approver?.let {
                        { Text(it, style = MaterialTheme.typography.labelSmall) }
                    }
                }
            )

            // Show action buttons for active focused step
            if (isFocused && step.status == "active") {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Button(
                        onClick = { onApprove(step.id) },
                        label = { Text("\u2713") }
                    )
                    Button(
                        onClick = { onReject(step.id) },
                        label = { Text("\u2717") }
                    )
                }
            }
        }
    }
}
