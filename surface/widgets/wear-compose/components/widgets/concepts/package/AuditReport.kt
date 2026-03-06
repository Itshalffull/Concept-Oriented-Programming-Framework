package com.clef.surface.widgets.concepts.pkg

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

enum class AuditReportState { Idle, VulnSelected }

sealed class AuditReportEvent {
    data class SelectVuln(val vulnId: String) : AuditReportEvent()
    object Deselect : AuditReportEvent()
}

fun auditReportReduce(
    state: AuditReportState,
    event: AuditReportEvent
): AuditReportState = when (state) {
    AuditReportState.Idle -> when (event) {
        is AuditReportEvent.SelectVuln -> AuditReportState.VulnSelected
        else -> state
    }
    AuditReportState.VulnSelected -> when (event) {
        is AuditReportEvent.Deselect -> AuditReportState.Idle
        is AuditReportEvent.SelectVuln -> AuditReportState.VulnSelected
    }
}

// --- Public types ---

enum class Severity { Critical, High, Moderate, Low }

data class Vulnerability(
    val id: String,
    val title: String,
    val severity: Severity,
    val description: String? = null,
    val packageName: String? = null,
    val fixAvailable: Boolean = false
)

private val SEVERITY_ICONS = mapOf(
    Severity.Critical to "\u2716",
    Severity.High to "\u26A0",
    Severity.Moderate to "\u25CF",
    Severity.Low to "\u25CB"
)

private val SEVERITY_COLORS = mapOf(
    Severity.Critical to Color(0xFFDC2626),
    Severity.High to Color(0xFFEF4444),
    Severity.Moderate to Color(0xFFF59E0B),
    Severity.Low to Color(0xFF3B82F6)
)

@Composable
fun AuditReport(
    vulnerabilities: List<Vulnerability>,
    modifier: Modifier = Modifier,
    reportStatus: String = "complete",
    onSelectVuln: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(AuditReportState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val critical = vulnerabilities.count { it.severity == Severity.Critical }
    val high = vulnerabilities.count { it.severity == Severity.High }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Audit report" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Audit (${vulnerabilities.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (critical > 0 || high > 0) {
            item {
                Text(
                    "${critical} critical, ${high} high",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (critical > 0) Color(0xFFDC2626) else Color(0xFFEF4444)
                )
            }
        }

        items(vulnerabilities) { vuln ->
            val icon = SEVERITY_ICONS[vuln.severity] ?: ""
            val color = SEVERITY_COLORS[vuln.severity] ?: Color.Gray
            val isSelected = selectedId == vuln.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else vuln.id
                    selectedId = nextId
                    state = auditReportReduce(
                        state,
                        if (nextId != null) AuditReportEvent.SelectVuln(nextId)
                        else AuditReportEvent.Deselect
                    )
                    if (nextId != null) onSelectVuln(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${vuln.title}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            vuln.description?.let { Text(it, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                            vuln.packageName?.let { Text("Pkg: $it", style = MaterialTheme.typography.labelSmall) }
                            if (vuln.fixAvailable) Text("\u2713 Fix available", style = MaterialTheme.typography.labelSmall, color = Color(0xFF22C55E))
                        }
                    }
                } else {
                    { Text(vuln.severity.name, style = MaterialTheme.typography.labelSmall, color = color) }
                }
            )
        }
    }
}
