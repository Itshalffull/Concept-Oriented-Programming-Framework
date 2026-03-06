package com.clef.surface.widgets.concepts.llmagent

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
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class HitlInterruptState { Pending, Approving, Rejecting, Resolved }

sealed class HitlInterruptEvent {
    object Approve : HitlInterruptEvent()
    object Reject : HitlInterruptEvent()
    object Confirm : HitlInterruptEvent()
    object Cancel : HitlInterruptEvent()
}

fun hitlInterruptReduce(
    state: HitlInterruptState,
    event: HitlInterruptEvent
): HitlInterruptState = when (state) {
    HitlInterruptState.Pending -> when (event) {
        is HitlInterruptEvent.Approve -> HitlInterruptState.Approving
        is HitlInterruptEvent.Reject -> HitlInterruptState.Rejecting
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
    HitlInterruptState.Resolved -> state
}

// --- Public types ---

enum class RiskLevel { Low, Medium, High, Critical }

private val RISK_ICONS = mapOf(
    RiskLevel.Low to "\u2713",
    RiskLevel.Medium to "\u26A0",
    RiskLevel.High to "\u2622",
    RiskLevel.Critical to "\u2716"
)

private val RISK_COLORS = mapOf(
    RiskLevel.Low to Color(0xFF22C55E),
    RiskLevel.Medium to Color(0xFFF59E0B),
    RiskLevel.High to Color(0xFFEF4444),
    RiskLevel.Critical to Color(0xFFDC2626)
)

@Composable
fun HitlInterrupt(
    action: String,
    reason: String,
    modifier: Modifier = Modifier,
    riskLevel: RiskLevel = RiskLevel.Medium,
    toolName: String? = null,
    onApprove: () -> Unit = {},
    onReject: () -> Unit = {}
) {
    var state by remember { mutableStateOf(HitlInterruptState.Pending) }
    val listState = rememberScalingLazyListState()

    val riskIcon = RISK_ICONS[riskLevel] ?: "\u26A0"
    val riskColor = RISK_COLORS[riskLevel] ?: Color.Yellow

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Human-in-the-loop interrupt" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$riskIcon Approval Needed",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Card(onClick = {}) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text(
                        text = action,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodySmall
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = reason,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    toolName?.let {
                        Text(
                            text = "Tool: $it",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    Text(
                        text = "${riskLevel.name} Risk",
                        color = riskColor,
                        style = MaterialTheme.typography.labelSmall
                    )
                }
            }
        }

        when (state) {
            HitlInterruptState.Pending -> {
                item {
                    Button(
                        onClick = {
                            state = hitlInterruptReduce(state, HitlInterruptEvent.Approve)
                        },
                        label = { Text("\u2713 Approve") }
                    )
                }
                item {
                    Button(
                        onClick = {
                            state = hitlInterruptReduce(state, HitlInterruptEvent.Reject)
                        },
                        label = { Text("\u2717 Reject") }
                    )
                }
            }
            HitlInterruptState.Approving -> {
                item {
                    Text("Confirm approval?", style = MaterialTheme.typography.bodySmall)
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                state = hitlInterruptReduce(state, HitlInterruptEvent.Confirm)
                                onApprove()
                            },
                            label = { Text("Yes") }
                        )
                        Button(
                            onClick = {
                                state = hitlInterruptReduce(state, HitlInterruptEvent.Cancel)
                            },
                            label = { Text("No") }
                        )
                    }
                }
            }
            HitlInterruptState.Rejecting -> {
                item {
                    Text("Confirm rejection?", style = MaterialTheme.typography.bodySmall)
                }
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = {
                                state = hitlInterruptReduce(state, HitlInterruptEvent.Confirm)
                                onReject()
                            },
                            label = { Text("Yes") }
                        )
                        Button(
                            onClick = {
                                state = hitlInterruptReduce(state, HitlInterruptEvent.Cancel)
                            },
                            label = { Text("No") }
                        )
                    }
                }
            }
            HitlInterruptState.Resolved -> {
                item {
                    Text(
                        "\u2713 Resolved",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFF22C55E)
                    )
                }
            }
        }
    }
}
