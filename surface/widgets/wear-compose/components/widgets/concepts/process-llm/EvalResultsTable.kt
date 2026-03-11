package com.clef.surface.widgets.concepts.processllm

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

enum class EvalResultsTableState { Idle, RowSelected }

sealed class EvalResultsTableEvent {
    data class SelectRow(val testId: String) : EvalResultsTableEvent()
    object Deselect : EvalResultsTableEvent()
}

fun evalResultsTableReduce(
    state: EvalResultsTableState,
    event: EvalResultsTableEvent
): EvalResultsTableState = when (state) {
    EvalResultsTableState.Idle -> when (event) {
        is EvalResultsTableEvent.SelectRow -> EvalResultsTableState.RowSelected
        else -> state
    }
    EvalResultsTableState.RowSelected -> when (event) {
        is EvalResultsTableEvent.Deselect -> EvalResultsTableState.Idle
        is EvalResultsTableEvent.SelectRow -> EvalResultsTableState.RowSelected
    }
}

// --- Public types ---

data class EvalTestCase(
    val id: String,
    val name: String,
    val status: String, // pass, fail, error, pending
    val score: Float? = null,
    val expected: String? = null,
    val actual: String? = null,
    val latencyMs: Long? = null
)

private val STATUS_ICONS = mapOf(
    "pass" to "\u2713",
    "fail" to "\u2717",
    "error" to "\u26A0",
    "pending" to "\u25CB"
)

private val STATUS_COLORS = mapOf(
    "pass" to Color(0xFF22C55E),
    "fail" to Color(0xFFEF4444),
    "error" to Color(0xFFF59E0B),
    "pending" to Color(0xFF9CA3AF)
)

@Composable
fun EvalResultsTable(
    testCases: List<EvalTestCase>,
    modifier: Modifier = Modifier,
    onSelect: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(EvalResultsTableState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val passed = testCases.count { it.status == "pass" }
    val failed = testCases.count { it.status == "fail" }
    val avgScore = testCases.mapNotNull { it.score }.let { scores ->
        if (scores.isNotEmpty()) scores.average().let { "%.1f".format(it) } else null
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Eval results" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Eval $passed/${testCases.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            val summaryParts = mutableListOf<String>()
            if (failed > 0) summaryParts.add("$failed failed")
            avgScore?.let { summaryParts.add("avg: $it") }
            Text(
                summaryParts.joinToString(" | ").ifEmpty { "All passed" },
                style = MaterialTheme.typography.labelSmall,
                color = if (failed > 0) Color(0xFFEF4444) else Color(0xFF22C55E)
            )
        }

        items(testCases) { testCase ->
            val icon = STATUS_ICONS[testCase.status] ?: "\u25CB"
            val color = STATUS_COLORS[testCase.status] ?: Color.Gray
            val isSelected = selectedId == testCase.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else testCase.id
                    selectedId = nextId
                    state = evalResultsTableReduce(
                        state,
                        if (nextId != null) EvalResultsTableEvent.SelectRow(nextId)
                        else EvalResultsTableEvent.Deselect
                    )
                    if (nextId != null) onSelect(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${testCase.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            testCase.score?.let { Text("Score: ${"%.2f".format(it)}", style = MaterialTheme.typography.labelSmall) }
                            testCase.latencyMs?.let { Text("${it}ms", style = MaterialTheme.typography.labelSmall) }
                            testCase.expected?.let { Text("Exp: $it", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                            testCase.actual?.let { Text("Got: $it", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                } else {
                    testCase.score?.let {
                        { Text("${"%.1f".format(it)}", style = MaterialTheme.typography.labelSmall) }
                    }
                }
            )
        }
    }
}
