package com.clef.surface.widgets.concepts.pkg

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class AuditReportState { Idle, Filtering, VulnSelected }

sealed class AuditReportEvent {
    data class Filter(val severity: String) : AuditReportEvent()
    data class SelectVuln(val id: String) : AuditReportEvent()
    object Clear : AuditReportEvent()
    object Deselect : AuditReportEvent()
}

fun auditReportReduce(state: AuditReportState, event: AuditReportEvent): AuditReportState = when (state) {
    AuditReportState.Idle -> when (event) {
        is AuditReportEvent.Filter -> AuditReportState.Filtering
        is AuditReportEvent.SelectVuln -> AuditReportState.VulnSelected
        else -> state
    }
    AuditReportState.Filtering -> when (event) {
        is AuditReportEvent.Clear -> AuditReportState.Idle
        else -> state
    }
    AuditReportState.VulnSelected -> when (event) {
        is AuditReportEvent.Deselect -> AuditReportState.Idle
        else -> state
    }
}

// --- Types ---

data class Vulnerability(
    val id: String,
    val title: String,
    val severity: String,
    val packageName: String,
    val installedVersion: String,
    val patchedVersion: String? = null,
    val description: String,
    val url: String? = null
)

// --- Helpers ---

private val SEVERITY_ORDER = mapOf("critical" to 0, "high" to 1, "moderate" to 2, "low" to 3)
private val SEVERITY_COLORS = mapOf(
    "critical" to Color(0xFFDC2626), "high" to Color(0xFFEA580C),
    "moderate" to Color(0xFFCA8A04), "low" to Color(0xFF2563EB)
)
private val ALL_SEVERITIES = listOf("critical", "high", "moderate", "low")

private fun countBySeverity(vulns: List<Vulnerability>): Map<String, Int> {
    val counts = mutableMapOf("critical" to 0, "high" to 0, "moderate" to 0, "low" to 0)
    for (v in vulns) counts[v.severity] = (counts[v.severity] ?: 0) + 1
    return counts
}

@Composable
fun AuditReport(
    vulnerabilities: List<Vulnerability>,
    lastScan: String,
    status: String,
    modifier: Modifier = Modifier,
    showRemediation: Boolean = true
) {
    var state by remember { mutableStateOf(AuditReportState.Idle) }
    var activeFilter by remember { mutableStateOf<String?>(null) }
    var selectedId by remember { mutableStateOf<String?>(null) }

    val counts = remember(vulnerabilities) { countBySeverity(vulnerabilities) }
    val sorted = remember(vulnerabilities) {
        vulnerabilities.sortedBy { SEVERITY_ORDER[it.severity] ?: 4 }
    }
    val displayed = remember(sorted, state, activeFilter) {
        if (state == AuditReportState.Filtering && activeFilter != null) sorted.filter { it.severity == activeFilter }
        else sorted
    }

    Column(modifier = modifier.semantics { contentDescription = "Security audit report" }) {
        // Header
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            Text(status, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Spacer(Modifier.weight(1f))
            Text("Last scan: $lastScan", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Severity distribution bar
        val total = counts.values.sum()
        if (total > 0) {
            Row(
                modifier = Modifier.fillMaxWidth().height(8.dp)
            ) {
                ALL_SEVERITIES.forEach { sev ->
                    val count = counts[sev] ?: 0
                    if (count > 0) {
                        Box(
                            modifier = Modifier
                                .weight(count.toFloat() / total)
                                .fillMaxHeight()
                                .then(Modifier.semantics { contentDescription = "$sev: $count" })
                        ) {
                            Surface(color = SEVERITY_COLORS[sev] ?: Color.Gray, modifier = Modifier.fillMaxSize()) {}
                        }
                    }
                }
            }
        }

        // Severity filter badges
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(vertical = 8.dp)
        ) {
            ALL_SEVERITIES.forEach { sev ->
                val isActive = activeFilter == sev && state == AuditReportState.Filtering
                FilterChip(
                    selected = isActive,
                    onClick = {
                        if (isActive) {
                            activeFilter = null
                            state = auditReportReduce(state, AuditReportEvent.Clear)
                        } else {
                            activeFilter = sev
                            state = auditReportReduce(state, AuditReportEvent.Filter(sev))
                        }
                    },
                    label = { Text("${counts[sev] ?: 0} $sev", fontSize = 11.sp) }
                )
            }
        }

        // Vulnerability list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(displayed) { _, vuln ->
                val isExpanded = selectedId == vuln.id && state == AuditReportState.VulnSelected
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp)
                        .clickable {
                            if (selectedId == vuln.id) {
                                selectedId = null
                                state = auditReportReduce(state, AuditReportEvent.Deselect)
                            } else {
                                selectedId = vuln.id
                                state = auditReportReduce(state, AuditReportEvent.SelectVuln(vuln.id))
                            }
                        },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isExpanded) MaterialTheme.colorScheme.errorContainer
                        else MaterialTheme.colorScheme.surface
                    )
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Surface(color = SEVERITY_COLORS[vuln.severity] ?: Color.Gray, shape = MaterialTheme.shapes.small) {
                                Text(
                                    vuln.severity.uppercase(),
                                    fontSize = 10.sp, fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                                )
                            }
                            Text(vuln.title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.weight(1f))
                            Text(
                                "${vuln.packageName}@${vuln.installedVersion}",
                                fontSize = 11.sp, fontFamily = FontFamily.Monospace,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }

                        if (isExpanded) {
                            Text(vuln.description, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                            if (showRemediation) {
                                Text(
                                    if (vuln.patchedVersion != null) "Fix: Upgrade ${vuln.packageName} to ${vuln.patchedVersion}"
                                    else "No patch available",
                                    fontSize = 12.sp,
                                    color = if (vuln.patchedVersion != null) MaterialTheme.colorScheme.onSurface else Color(0xFFB91C1C),
                                    modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }
            }

            if (displayed.isEmpty()) {
                item {
                    Text(
                        if (state == AuditReportState.Filtering) "No vulnerabilities match the selected severity."
                        else "No vulnerabilities found.",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}
