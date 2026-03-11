package com.clef.surface.widgets.concepts.llmagent

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
import kotlinx.coroutines.delay

// --- State machine ---

enum class HitlInterruptState { Pending, Editing, Approving, Rejecting, Forking, Resolved }

sealed class HitlInterruptEvent {
    object Edit : HitlInterruptEvent()
    object Approve : HitlInterruptEvent()
    object Reject : HitlInterruptEvent()
    object Fork : HitlInterruptEvent()
    object Confirm : HitlInterruptEvent()
    object Cancel : HitlInterruptEvent()
    object AutoDeny : HitlInterruptEvent()
    object ShowInfo : HitlInterruptEvent()
}

fun hitlInterruptReduce(state: HitlInterruptState, event: HitlInterruptEvent): HitlInterruptState = when (state) {
    HitlInterruptState.Pending -> when (event) {
        is HitlInterruptEvent.Edit -> HitlInterruptState.Editing
        is HitlInterruptEvent.Approve -> HitlInterruptState.Approving
        is HitlInterruptEvent.Reject -> HitlInterruptState.Rejecting
        is HitlInterruptEvent.Fork -> HitlInterruptState.Forking
        is HitlInterruptEvent.AutoDeny -> HitlInterruptState.Resolved
        else -> state
    }
    HitlInterruptState.Editing -> when (event) {
        is HitlInterruptEvent.Approve -> HitlInterruptState.Approving
        is HitlInterruptEvent.Cancel -> HitlInterruptState.Pending
        else -> state
    }
    HitlInterruptState.Approving -> when (event) {
        is HitlInterruptEvent.Confirm -> HitlInterruptState.Resolved
        is HitlInterruptEvent.Cancel -> HitlInterruptState.Pending
        else -> state
    }
    HitlInterruptState.Rejecting -> when (event) {
        is HitlInterruptEvent.Confirm -> HitlInterruptState.Resolved
        is HitlInterruptEvent.Cancel -> HitlInterruptState.Pending
        else -> state
    }
    HitlInterruptState.Forking -> when (event) {
        is HitlInterruptEvent.Confirm -> HitlInterruptState.Resolved
        is HitlInterruptEvent.Cancel -> HitlInterruptState.Pending
        else -> state
    }
    HitlInterruptState.Resolved -> state
}

// --- Types ---

enum class RiskLevel(val label: String) { Low("Low"), Medium("Medium"), High("High"), Critical("Critical") }

@Composable
fun HitlInterrupt(
    reason: String,
    description: String,
    modifier: Modifier = Modifier,
    riskLevel: RiskLevel = RiskLevel.Medium,
    autoDenySeconds: Int? = null,
    context: String? = null,
    onApprove: () -> Unit = {},
    onReject: (String?) -> Unit = {},
    onFork: () -> Unit = {}
) {
    var state by remember { mutableStateOf(HitlInterruptState.Pending) }
    var rejectReason by remember { mutableStateOf("") }
    var countdown by remember { mutableIntStateOf(autoDenySeconds ?: 0) }

    // Auto-deny countdown
    if (autoDenySeconds != null && autoDenySeconds > 0) {
        LaunchedEffect(state) {
            if (state == HitlInterruptState.Pending) {
                countdown = autoDenySeconds
                while (countdown > 0) {
                    delay(1000)
                    countdown--
                }
                state = hitlInterruptReduce(state, HitlInterruptEvent.AutoDeny)
                onReject("Auto-denied after timeout")
            }
        }
    }

    val riskColor = when (riskLevel) {
        RiskLevel.Low -> MaterialTheme.colorScheme.primary
        RiskLevel.Medium -> MaterialTheme.colorScheme.tertiary
        RiskLevel.High -> MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
        RiskLevel.Critical -> MaterialTheme.colorScheme.error
    }

    Card(
        modifier = modifier.fillMaxWidth().semantics { contentDescription = "Human-in-the-loop approval: $reason" }
    ) {
        Column(Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Approval Required", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.weight(1f))
                Surface(color = riskColor.copy(alpha = 0.15f), shape = MaterialTheme.shapes.small) {
                    Text(riskLevel.label, color = riskColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp))
                }
            }

            Spacer(Modifier.height(8.dp))
            Text(reason, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))

            // Context
            context?.let {
                Surface(tonalElevation = 1.dp, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    Text(it, fontSize = 12.sp, modifier = Modifier.padding(8.dp))
                }
            }

            // Auto-deny countdown
            if (autoDenySeconds != null && state == HitlInterruptState.Pending && countdown > 0) {
                Text("Auto-deny in ${countdown}s", fontSize = 12.sp, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 8.dp))
                LinearProgressIndicator(
                    progress = { countdown.toFloat() / autoDenySeconds },
                    modifier = Modifier.fillMaxWidth().padding(top = 4.dp)
                )
            }

            Spacer(Modifier.height(12.dp))

            // Action buttons
            when (state) {
                HitlInterruptState.Pending -> {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = {
                            state = hitlInterruptReduce(state, HitlInterruptEvent.Approve)
                        }) { Text("Approve") }
                        OutlinedButton(onClick = {
                            state = hitlInterruptReduce(state, HitlInterruptEvent.Reject)
                        }) { Text("Deny") }
                        TextButton(onClick = {
                            state = hitlInterruptReduce(state, HitlInterruptEvent.Edit)
                        }) { Text("Edit") }
                    }
                }
                HitlInterruptState.Approving -> {
                    Text("Confirm approval?", fontWeight = FontWeight.Medium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        Button(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Confirm); onApprove() }) { Text("Confirm") }
                        OutlinedButton(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Cancel) }) { Text("Cancel") }
                    }
                }
                HitlInterruptState.Rejecting -> {
                    OutlinedTextField(
                        value = rejectReason, onValueChange = { rejectReason = it },
                        label = { Text("Rejection reason") },
                        modifier = Modifier.fillMaxWidth()
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        Button(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Confirm); onReject(rejectReason.ifBlank { null }) }) { Text("Confirm Deny") }
                        OutlinedButton(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Cancel) }) { Text("Cancel") }
                    }
                }
                HitlInterruptState.Editing -> {
                    Text("Edit mode - modify context before approving", fontSize = 13.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        Button(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Approve) }) { Text("Approve") }
                        OutlinedButton(onClick = { state = hitlInterruptReduce(state, HitlInterruptEvent.Cancel) }) { Text("Cancel") }
                    }
                }
                HitlInterruptState.Resolved -> {
                    Text("\u2713 Resolved", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
                }
                else -> {}
            }
        }
    }
}
