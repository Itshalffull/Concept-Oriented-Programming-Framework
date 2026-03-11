package com.clef.surface.widgets.concepts.processllm

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

enum class EvalResultsTableState { Idle, RowSelected }

sealed class EvalResultsTableEvent {
    data class SelectRow(val id: String) : EvalResultsTableEvent()
    object Sort : EvalResultsTableEvent()
    object Filter : EvalResultsTableEvent()
    object Deselect : EvalResultsTableEvent()
}

fun evalResultsTableReduce(state: EvalResultsTableState, event: EvalResultsTableEvent): EvalResultsTableState = when (state) {
    EvalResultsTableState.Idle -> when (event) {
        is EvalResultsTableEvent.SelectRow -> EvalResultsTableState.RowSelected
        is EvalResultsTableEvent.Sort -> EvalResultsTableState.Idle
        is EvalResultsTableEvent.Filter -> EvalResultsTableState.Idle
        else -> state
    }
    EvalResultsTableState.RowSelected -> when (event) {
        is EvalResultsTableEvent.Deselect -> EvalResultsTableState.Idle
        is EvalResultsTableEvent.SelectRow -> EvalResultsTableState.RowSelected
        else -> state
    }
}

// --- Types ---

data class EvalTestCase(
    val id: String,
    val input: String,
    val expected: String,
    val actual: String,
    val score: Int,
    val pass: Boolean,
    val metrics: Map<String, Int> = emptyMap()
)

// --- Helpers ---

private fun truncate(text: String, max: Int): String =
    if (text.length <= max) text else text.take(max - 3) + "..."

private fun compareCases(a: EvalTestCase, b: EvalTestCase, key: String, order: String): Int {
    val cmp = when (key) {
        "score" -> a.score - b.score
        "status" -> (if (a.pass) 1 else 0) - (if (b.pass) 1 else 0)
        "input" -> a.input.compareTo(b.input)
        "actual" -> a.actual.compareTo(b.actual)
        "expected" -> a.expected.compareTo(b.expected)
        else -> 0
    }
    return if (order == "desc") -cmp else cmp
}

@Composable
fun EvalResultsTable(
    testCases: List<EvalTestCase>,
    overallScore: Int,
    passCount: Int,
    failCount: Int,
    modifier: Modifier = Modifier,
    showExpected: Boolean = true,
    onSelect: (EvalTestCase) -> Unit = {}
) {
    var state by remember { mutableStateOf(EvalResultsTableState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var sortByCol by remember { mutableStateOf("score") }
    var sortOrd by remember { mutableStateOf("desc") }
    var activeFilter by remember { mutableStateOf<String?>(null) }

    // Filter
    val filteredCases = remember(testCases, activeFilter) {
        when (activeFilter) {
            "pass" -> testCases.filter { it.pass }
            "fail" -> testCases.filter { !it.pass }
            else -> testCases
        }
    }

    // Sort
    val sortedCases = remember(filteredCases, sortByCol, sortOrd) {
        filteredCases.sortedWith { a, b -> compareCases(a, b, sortByCol, sortOrd) }
    }

    val totalCount = passCount + failCount
    val passPercent = if (totalCount > 0) (passCount * 100 / totalCount) else 0

    val selectedCase = selectedId?.let { id -> sortedCases.find { it.id == id } }

    Column(modifier = modifier.semantics { contentDescription = "Evaluation results" }) {
        // Summary bar
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            Text("${overallScore}%", fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Text("$passCount passed", fontSize = 13.sp, color = Color(0xFF16A34A))
            Text("$failCount failed", fontSize = 13.sp, color = Color(0xFFDC2626))
        }

        // Pass/fail ratio bar
        if (totalCount > 0) {
            Row(modifier = Modifier.fillMaxWidth().height(6.dp)) {
                if (passPercent > 0) {
                    Surface(color = Color(0xFF16A34A), modifier = Modifier.weight(passPercent.toFloat()).fillMaxHeight()) {}
                }
                if (passPercent < 100) {
                    Surface(color = Color(0xFFDC2626), modifier = Modifier.weight((100 - passPercent).toFloat()).fillMaxHeight()) {}
                }
            }
        }

        // Filter buttons
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(vertical = 8.dp)
        ) {
            FilterChip(selected = activeFilter == null, onClick = { activeFilter = null; state = evalResultsTableReduce(state, EvalResultsTableEvent.Filter) },
                label = { Text("All (${testCases.size})", fontSize = 11.sp) })
            FilterChip(selected = activeFilter == "pass", onClick = { activeFilter = if (activeFilter == "pass") null else "pass"; state = evalResultsTableReduce(state, EvalResultsTableEvent.Filter) },
                label = { Text("Pass ($passCount)", fontSize = 11.sp) })
            FilterChip(selected = activeFilter == "fail", onClick = { activeFilter = if (activeFilter == "fail") null else "fail"; state = evalResultsTableReduce(state, EvalResultsTableEvent.Filter) },
                label = { Text("Fail ($failCount)", fontSize = 11.sp) })
        }

        // Column headers
        Row(
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf("status" to "Status", "input" to "Input", "actual" to "Output").let { cols ->
                val allCols = if (showExpected) cols + ("expected" to "Expected") else cols
                (allCols + ("score" to "Score")).forEach { (col, label) ->
                    Text(
                        "$label${if (sortByCol == col) (if (sortOrd == "asc") " \u25B2" else " \u25BC") else ""}",
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 11.sp,
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                if (sortByCol == col) sortOrd = if (sortOrd == "asc") "desc" else "asc"
                                else { sortByCol = col; sortOrd = "desc" }
                                state = evalResultsTableReduce(state, EvalResultsTableEvent.Sort)
                            }
                    )
                }
            }
        }

        HorizontalDivider()

        // Data rows
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(sortedCases) { _, tc ->
                val isSelected = selectedId == tc.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            if (selectedId == tc.id) {
                                selectedId = null
                                state = evalResultsTableReduce(state, EvalResultsTableEvent.Deselect)
                            } else {
                                selectedId = tc.id
                                state = evalResultsTableReduce(state, EvalResultsTableEvent.SelectRow(tc.id))
                                onSelect(tc)
                            }
                        }
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        if (tc.pass) "\u2713 Pass" else "\u2717 Fail",
                        fontSize = 11.sp,
                        color = if (tc.pass) Color(0xFF16A34A) else Color(0xFFDC2626),
                        modifier = Modifier.weight(1f)
                    )
                    Text(truncate(tc.input, 40), fontSize = 11.sp, modifier = Modifier.weight(1f))
                    Text(truncate(tc.actual, 40), fontSize = 11.sp, modifier = Modifier.weight(1f))
                    if (showExpected) {
                        Text(truncate(tc.expected, 40), fontSize = 11.sp, modifier = Modifier.weight(1f))
                    }
                    Text("${tc.score}", fontSize = 11.sp, fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal, modifier = Modifier.weight(1f))
                }
                HorizontalDivider()
            }

            if (sortedCases.isEmpty()) {
                item {
                    Text("No test cases match the current filter", modifier = Modifier.padding(12.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // Detail panel
        if (state == EvalResultsTableState.RowSelected && selectedCase != null) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    if (selectedCase.pass) "\u2713 Passed" else "\u2717 Failed",
                    color = if (selectedCase.pass) Color(0xFF16A34A) else Color(0xFFDC2626),
                    fontWeight = FontWeight.SemiBold
                )
                Text("Score: ${selectedCase.score}")
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { selectedId = null; state = evalResultsTableReduce(state, EvalResultsTableEvent.Deselect) }) {
                    Text("\u2715")
                }
            }

            Text("Input", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
            Text(selectedCase.input, fontFamily = FontFamily.Monospace, fontSize = 12.sp)

            Text("Model Output", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            Text(selectedCase.actual, fontFamily = FontFamily.Monospace, fontSize = 12.sp)

            Text("Expected Output", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            Text(selectedCase.expected, fontFamily = FontFamily.Monospace, fontSize = 12.sp)

            // Metrics
            if (selectedCase.metrics.isNotEmpty()) {
                Text("Metrics", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                selectedCase.metrics.forEach { (metric, value) ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(vertical = 2.dp)
                    ) {
                        Text(metric, fontSize = 12.sp, modifier = Modifier.width(100.dp))
                        LinearProgressIndicator(
                            progress = { minOf(100, value) / 100f },
                            modifier = Modifier.weight(1f).height(6.dp)
                        )
                        Text("$value", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
