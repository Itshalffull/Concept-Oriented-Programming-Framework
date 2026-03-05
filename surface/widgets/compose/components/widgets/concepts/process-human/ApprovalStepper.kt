package com.clef.surface.widgets.concepts.processhuman

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class ApprovalStepperState { Viewing, StepFocused, Acting }

sealed class ApprovalStepperEvent {
    data class FocusStep(val id: String) : ApprovalStepperEvent()
    object StartAction : ApprovalStepperEvent()
    object Blur : ApprovalStepperEvent()
    object Complete : ApprovalStepperEvent()
    object Cancel : ApprovalStepperEvent()
}

fun approvalStepperReduce(state: ApprovalStepperState, event: ApprovalStepperEvent): ApprovalStepperState = when (state) {
    ApprovalStepperState.Viewing -> when (event) {
        is ApprovalStepperEvent.FocusStep -> ApprovalStepperState.StepFocused
        is ApprovalStepperEvent.StartAction -> ApprovalStepperState.Acting
        else -> state
    }
    ApprovalStepperState.StepFocused -> when (event) {
        is ApprovalStepperEvent.Blur -> ApprovalStepperState.Viewing
        is ApprovalStepperEvent.StartAction -> ApprovalStepperState.Acting
        else -> state
    }
    ApprovalStepperState.Acting -> when (event) {
        is ApprovalStepperEvent.Complete -> ApprovalStepperState.Viewing
        is ApprovalStepperEvent.Cancel -> ApprovalStepperState.Viewing
        else -> state
    }
}

// --- Types ---

data class ApprovalStep(
    val id: String,
    val label: String,
    val approver: String? = null,
    val status: String, // "pending", "approved", "rejected", "skipped", "active"
    val timestamp: String? = null,
    val quorumRequired: Int? = null,
    val quorumCurrent: Int? = null
)

// --- Helpers ---

private fun stepStatusIcon(status: String): String = when (status) {
    "approved" -> "\u2713"
    "rejected" -> "\u2717"
    "skipped" -> "\u2014"
    "active" -> "\u25CF"
    else -> "\u25CB"
}

private fun formatTimeRemaining(dueAt: String): String {
    val now = System.currentTimeMillis()
    val due = try { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(dueAt)?.time ?: now } catch (_: Exception) { now }
    val diff = due - now
    if (diff <= 0) return "Overdue"
    val hours = (diff / 3600000).toInt()
    val minutes = ((diff % 3600000) / 60000).toInt()
    return when {
        hours > 24 -> "${hours / 24}d ${hours % 24}h"
        hours > 0 -> "${hours}h ${minutes}m"
        else -> "${minutes}m"
    }
}

@Composable
fun ApprovalStepper(
    steps: List<ApprovalStep>,
    currentStep: String,
    status: String,
    modifier: Modifier = Modifier,
    assignee: String? = null,
    dueAt: String? = null,
    variant: String = "sequential",
    orientation: String = "horizontal",
    showSLA: Boolean = true,
    showAssignee: Boolean = true,
    onApprove: (String) -> Unit = {},
    onReject: (String) -> Unit = {},
    onDelegate: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(ApprovalStepperState.Viewing) }
    var focusedIndex by remember { mutableIntStateOf(0) }
    var actingStepId by remember { mutableStateOf<String?>(null) }

    Column(modifier = modifier.semantics { contentDescription = "Approval steps" }) {
        // Steps
        steps.forEachIndexed { index, step ->
            val isCurrent = step.id == currentStep
            val isActing = actingStepId == step.id && state == ApprovalStepperState.Acting

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clickable {
                        focusedIndex = index
                        state = approvalStepperReduce(state, ApprovalStepperEvent.FocusStep(step.id))
                    },
                colors = CardDefaults.cardColors(
                    containerColor = if (isCurrent) MaterialTheme.colorScheme.primaryContainer
                    else MaterialTheme.colorScheme.surface
                )
            ) {
                Column(Modifier.padding(8.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Step indicator
                        Text(
                            if (step.status == "pending" || step.status == "active") "${index + 1}" else stepStatusIcon(step.status),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )

                        // Label
                        Text(step.label, fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal, fontSize = 13.sp)

                        Spacer(Modifier.weight(1f))

                        // Status
                        Text(step.status, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    // Approver
                    if (showAssignee && step.approver != null) {
                        Text(step.approver, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
                    }

                    // Quorum
                    if (variant != "sequential" && step.quorumRequired != null) {
                        Text(
                            "${step.quorumCurrent ?: 0}/${step.quorumRequired} approvals",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp)
                        )
                    }

                    // Timestamp
                    if (step.timestamp != null) {
                        Text(step.timestamp, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
                    }

                    // Action bar
                    if (isActing) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 8.dp)
                        ) {
                            Button(onClick = {
                                onApprove(step.id)
                                state = approvalStepperReduce(state, ApprovalStepperEvent.Complete)
                                actingStepId = null
                            }) { Text("Approve") }
                            OutlinedButton(onClick = {
                                onReject(step.id)
                                state = approvalStepperReduce(state, ApprovalStepperEvent.Complete)
                                actingStepId = null
                            }) { Text("Reject") }
                            TextButton(onClick = {
                                onDelegate(step.id)
                                state = approvalStepperReduce(state, ApprovalStepperEvent.Complete)
                                actingStepId = null
                            }) { Text("Delegate") }
                            TextButton(onClick = {
                                state = approvalStepperReduce(state, ApprovalStepperEvent.Cancel)
                                actingStepId = null
                            }) { Text("Cancel") }
                        }
                    }

                    // Tap to act (only on current/active steps)
                    if (!isActing && (isCurrent || step.status == "active")) {
                        TextButton(onClick = {
                            actingStepId = step.id
                            state = approvalStepperReduce(state, ApprovalStepperEvent.StartAction)
                        }) {
                            Text("Take Action", fontSize = 12.sp)
                        }
                    }
                }
            }
        }

        // SLA indicator
        if (showSLA && dueAt != null) {
            val isOverdue = try {
                java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss").parse(dueAt)?.time?.let { it < System.currentTimeMillis() } ?: false
            } catch (_: Exception) { false }

            Text(
                "SLA: ${formatTimeRemaining(dueAt)}",
                fontSize = 13.sp,
                color = if (isOverdue) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}
