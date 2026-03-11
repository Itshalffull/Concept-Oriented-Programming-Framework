package com.clef.surface.widgets.concepts.processfoundation

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

enum class RunListTableState { Idle, RowSelected }

sealed class RunListTableEvent {
    data class SelectRow(val id: String) : RunListTableEvent()
    object Sort : RunListTableEvent()
    object Filter : RunListTableEvent()
    object Page : RunListTableEvent()
    object Deselect : RunListTableEvent()
}

fun runListTableReduce(state: RunListTableState, event: RunListTableEvent): RunListTableState = when (state) {
    RunListTableState.Idle -> when (event) {
        is RunListTableEvent.SelectRow -> RunListTableState.RowSelected
        is RunListTableEvent.Sort -> RunListTableState.Idle
        is RunListTableEvent.Filter -> RunListTableState.Idle
        is RunListTableEvent.Page -> RunListTableState.Idle
        else -> state
    }
    RunListTableState.RowSelected -> when (event) {
        is RunListTableEvent.Deselect -> RunListTableState.Idle
        is RunListTableEvent.SelectRow -> RunListTableState.RowSelected
        else -> state
    }
}

// --- Types ---

data class ProcessRun(
    val id: String,
    val processName: String,
    val status: String, // "running", "completed", "failed", "cancelled", "pending"
    val startedAt: String,
    val duration: String? = null,
    val outcome: String? = null // "success", "failure", "cancelled", "pending"
)

// --- Helpers ---

private val STATUS_ORDER = mapOf("running" to 0, "pending" to 1, "completed" to 2, "failed" to 3, "cancelled" to 4)
private val STATUS_LABELS = mapOf(
    "running" to "Running", "completed" to "Completed", "failed" to "Failed",
    "cancelled" to "Cancelled", "pending" to "Pending"
)
private val ALL_STATUSES = listOf("running", "pending", "completed", "failed", "cancelled")

private fun outcomeIcon(outcome: String?): String = when (outcome) {
    "success" -> "\u2713"
    "failure" -> "\u2717"
    "cancelled" -> "\u2014"
    else -> "\u25CB"
}

private fun compareRuns(a: ProcessRun, b: ProcessRun, key: String, order: String): Int {
    val cmp = when (key) {
        "processName" -> a.processName.compareTo(b.processName)
        "status" -> (STATUS_ORDER[a.status] ?: 5) - (STATUS_ORDER[b.status] ?: 5)
        "startedAt" -> a.startedAt.compareTo(b.startedAt)
        "duration" -> (a.duration ?: "").compareTo(b.duration ?: "")
        else -> 0
    }
    return if (order == "desc") -cmp else cmp
}

@Composable
fun RunListTable(
    runs: List<ProcessRun>,
    modifier: Modifier = Modifier,
    pageSize: Int = 20,
    onSelect: (ProcessRun) -> Unit = {},
    onCancel: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(RunListTableState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var sortByCol by remember { mutableStateOf("startedAt") }
    var sortOrd by remember { mutableStateOf("desc") }
    var activeFilter by remember { mutableStateOf<String?>(null) }
    var currentPage by remember { mutableIntStateOf(0) }

    // Filter
    val filteredRuns = remember(runs, activeFilter) {
        if (activeFilter == null) runs else runs.filter { it.status == activeFilter }
    }

    // Sort
    val sortedRuns = remember(filteredRuns, sortByCol, sortOrd) {
        filteredRuns.sortedWith { a, b -> compareRuns(a, b, sortByCol, sortOrd) }
    }

    // Paginate
    val totalPages = maxOf(1, (sortedRuns.size + pageSize - 1) / pageSize)
    val pageRuns = remember(sortedRuns, currentPage, pageSize) {
        val start = currentPage * pageSize
        sortedRuns.subList(start, minOf(start + pageSize, sortedRuns.size))
    }

    Column(modifier = modifier.semantics { contentDescription = "Process runs" }) {
        // Filter bar
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            FilterChip(
                selected = activeFilter == null,
                onClick = { activeFilter = null; currentPage = 0; state = runListTableReduce(state, RunListTableEvent.Filter) },
                label = { Text("All (${runs.size})", fontSize = 11.sp) }
            )
            ALL_STATUSES.forEach { s ->
                val count = runs.count { it.status == s }
                if (count > 0) {
                    FilterChip(
                        selected = activeFilter == s,
                        onClick = {
                            activeFilter = if (activeFilter == s) null else s
                            currentPage = 0
                            state = runListTableReduce(state, RunListTableEvent.Filter)
                        },
                        label = { Text("${STATUS_LABELS[s]} ($count)", fontSize = 11.sp) }
                    )
                }
            }
        }

        // Column headers
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            listOf("status" to "Status", "processName" to "Process", "startedAt" to "Started", "duration" to "Duration", "outcome" to "Outcome").forEach { (col, label) ->
                Text(
                    "$label${if (sortByCol == col) (if (sortOrd == "asc") " \u25B2" else " \u25BC") else ""}",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .weight(1f)
                        .clickable {
                            if (sortByCol == col) sortOrd = if (sortOrd == "asc") "desc" else "asc"
                            else { sortByCol = col; sortOrd = "asc" }
                            state = runListTableReduce(state, RunListTableEvent.Sort)
                        }
                )
            }
        }

        HorizontalDivider()

        // Data rows
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(pageRuns) { _, run ->
                val isSelected = selectedId == run.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedId = run.id
                            state = runListTableReduce(state, RunListTableEvent.SelectRow(run.id))
                            onSelect(run)
                        }
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(STATUS_LABELS[run.status] ?: run.status, fontSize = 12.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.weight(1f))
                    Text(run.processName, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text(run.startedAt, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text(run.duration ?: "\u2014", fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text(outcomeIcon(run.outcome), fontSize = 12.sp, modifier = Modifier.weight(1f))
                }
                HorizontalDivider()
            }

            if (pageRuns.isEmpty()) {
                item {
                    Text(
                        "No runs match the current filter",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Pagination
        if (totalPages > 1) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 8.dp)
            ) {
                TextButton(onClick = { currentPage = maxOf(0, currentPage - 1); state = runListTableReduce(state, RunListTableEvent.Page) }, enabled = currentPage > 0) {
                    Text("\u2190")
                }
                Text("Page ${currentPage + 1} of $totalPages", fontSize = 12.sp)
                TextButton(onClick = { currentPage = minOf(totalPages - 1, currentPage + 1); state = runListTableReduce(state, RunListTableEvent.Page) }, enabled = currentPage < totalPages - 1) {
                    Text("\u2192")
                }
            }
        }
    }
}
