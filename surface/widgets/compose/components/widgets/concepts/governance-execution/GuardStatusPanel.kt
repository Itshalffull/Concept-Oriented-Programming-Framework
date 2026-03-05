package com.clef.surface.widgets.concepts.governanceexecution

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
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

enum class GuardStatusPanelState { Idle, GuardSelected }

sealed class GuardStatusPanelEvent {
    data class SelectGuard(val id: String?) : GuardStatusPanelEvent()
    object GuardTrip : GuardStatusPanelEvent()
    object Deselect : GuardStatusPanelEvent()
}

fun guardStatusPanelReduce(state: GuardStatusPanelState, event: GuardStatusPanelEvent): GuardStatusPanelState = when (state) {
    GuardStatusPanelState.Idle -> when (event) {
        is GuardStatusPanelEvent.SelectGuard -> GuardStatusPanelState.GuardSelected
        is GuardStatusPanelEvent.GuardTrip -> GuardStatusPanelState.Idle
        else -> state
    }
    GuardStatusPanelState.GuardSelected -> when (event) {
        is GuardStatusPanelEvent.Deselect -> GuardStatusPanelState.Idle
        else -> state
    }
}

// --- Types ---

enum class GuardStatus(val icon: String, val label: String) {
    Passing("\u2713", "Passing"),
    Failing("\u2717", "Failing"),
    Pending("\u23F3", "Pending"),
    Bypassed("\u2298", "Bypassed")
}

data class Guard(
    val id: String? = null,
    val name: String,
    val description: String,
    val status: GuardStatus,
    val lastChecked: String? = null
)

private fun deriveOverallStatus(guards: List<Guard>): String {
    if (guards.isEmpty()) return "all-passing"
    if (guards.any { it.status == GuardStatus.Failing }) return "has-failing"
    if (guards.any { it.status == GuardStatus.Pending }) return "has-pending"
    return "all-passing"
}

@Composable
fun GuardStatusPanel(
    guards: List<Guard>,
    modifier: Modifier = Modifier,
    onGuardSelect: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(GuardStatusPanelState.Idle) }
    var selectedGuardId by remember { mutableStateOf<String?>(null) }

    val overallStatus = remember(guards) { deriveOverallStatus(guards) }
    val hasBlocking = overallStatus == "has-failing"
    val selectedGuard = remember(selectedGuardId, guards) {
        selectedGuardId?.let { id -> guards.find { (it.id ?: it.name) == id } }
    }

    fun handleSelect(guardId: String) {
        val nextId = if (guardId == selectedGuardId) null else guardId
        selectedGuardId = nextId
        onGuardSelect(nextId)
        state = if (nextId != null) GuardStatusPanelState.GuardSelected else GuardStatusPanelState.Idle
    }

    Column(modifier = modifier.semantics { contentDescription = "Pre-execution guards" }) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text("Pre-execution Guards", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            val statusText = when (overallStatus) {
                "all-passing" -> "\u2713 All passing"
                "has-failing" -> "\u2717 Blocked"
                "has-pending" -> "\u23F3 Pending"
                else -> "Unknown"
            }
            val statusColor = when (overallStatus) {
                "all-passing" -> MaterialTheme.colorScheme.primary
                "has-failing" -> MaterialTheme.colorScheme.error
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }
            Text(statusText, fontSize = 13.sp, color = statusColor, fontWeight = FontWeight.Medium)
        }

        // Blocking banner
        if (hasBlocking) {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                Text(
                    "Execution blocked by failing guards",
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        HorizontalDivider()

        // Guard list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(guards, key = { _, g -> g.id ?: g.name }) { _, guard ->
                val guardId = guard.id ?: guard.name
                val isSelected = selectedGuardId == guardId

                val statusColor = when (guard.status) {
                    GuardStatus.Passing -> MaterialTheme.colorScheme.primary
                    GuardStatus.Failing -> MaterialTheme.colorScheme.error
                    GuardStatus.Pending -> MaterialTheme.colorScheme.onSurfaceVariant
                    GuardStatus.Bypassed -> MaterialTheme.colorScheme.outline
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { handleSelect(guardId) }
                        .then(
                            if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f))
                            else Modifier
                        )
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(guard.status.icon, fontSize = 16.sp, color = statusColor)
                        Text(guard.name, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        Text(guard.status.label, fontSize = 12.sp, color = statusColor)
                    }

                    // Expanded detail when selected
                    if (isSelected) {
                        Column(modifier = Modifier.padding(start = 24.dp, top = 4.dp)) {
                            Text(guard.description, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            guard.lastChecked?.let {
                                Text("Last checked: $it", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }
                }

                HorizontalDivider()
            }
        }
    }
}
