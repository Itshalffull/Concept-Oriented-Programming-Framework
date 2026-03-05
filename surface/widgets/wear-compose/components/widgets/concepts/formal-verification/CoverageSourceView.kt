package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.itemsIndexed
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class CoverageSourceViewState { Idle, LineSelected }

sealed class CoverageSourceViewEvent {
    data class SelectLine(val lineIndex: Int) : CoverageSourceViewEvent()
    data class Filter(val status: CoverageFilter) : CoverageSourceViewEvent()
    object JumpUncovered : CoverageSourceViewEvent()
    object Deselect : CoverageSourceViewEvent()
}

fun coverageSourceViewReduce(
    state: CoverageSourceViewState,
    event: CoverageSourceViewEvent
): CoverageSourceViewState = when (state) {
    CoverageSourceViewState.Idle -> when (event) {
        is CoverageSourceViewEvent.SelectLine -> CoverageSourceViewState.LineSelected
        is CoverageSourceViewEvent.Filter -> CoverageSourceViewState.Idle
        is CoverageSourceViewEvent.JumpUncovered -> CoverageSourceViewState.Idle
        else -> state
    }
    CoverageSourceViewState.LineSelected -> when (event) {
        is CoverageSourceViewEvent.Deselect -> CoverageSourceViewState.Idle
        is CoverageSourceViewEvent.SelectLine -> CoverageSourceViewState.LineSelected
        else -> state
    }
}

// --- Public types ---

enum class CoverageStatus { Covered, Uncovered, Partial }
enum class CoverageFilter { All, Covered, Uncovered, Partial }

data class CoverageLine(
    val number: Int,
    val text: String,
    val coverage: CoverageStatus?,
    val coveredBy: String? = null
)

data class CoverageSummary(
    val totalLines: Int,
    val coveredLines: Int,
    val percentage: Float
)

private val gutterColors = mapOf(
    CoverageStatus.Covered to Color(0xFF22C55E),
    CoverageStatus.Uncovered to Color(0xFFEF4444),
    CoverageStatus.Partial to Color(0xFFEAB308)
)

@Composable
fun CoverageSourceView(
    lines: List<CoverageLine>,
    summary: CoverageSummary,
    modifier: Modifier = Modifier,
    filterStatus: CoverageFilter = CoverageFilter.All,
    onLineSelect: (CoverageLine) -> Unit = {},
    onFilterChange: (CoverageFilter) -> Unit = {}
) {
    var state by remember { mutableStateOf(CoverageSourceViewState.Idle) }
    var selectedLineIndex by remember { mutableStateOf<Int?>(null) }
    var activeFilter by remember { mutableStateOf(filterStatus) }

    LaunchedEffect(filterStatus) { activeFilter = filterStatus }

    val filteredLines = remember(lines, activeFilter) {
        if (activeFilter == CoverageFilter.All) lines
        else lines.filter {
            when (activeFilter) {
                CoverageFilter.Covered -> it.coverage == CoverageStatus.Covered
                CoverageFilter.Uncovered -> it.coverage == CoverageStatus.Uncovered
                CoverageFilter.Partial -> it.coverage == CoverageStatus.Partial
                CoverageFilter.All -> true
            }
        }
    }

    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier.fillMaxSize(),
        state = listState
    ) {
        // Summary header
        item {
            ListHeader {
                Text(
                    text = "${summary.percentage}% Coverage",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                text = "${summary.coveredLines}/${summary.totalLines} lines",
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.padding(horizontal = 8.dp)
            )
        }

        // Filter chips
        item {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(vertical = 4.dp)
            ) {
                CoverageFilter.entries.forEach { filter ->
                    Button(
                        onClick = {
                            activeFilter = filter
                            selectedLineIndex = null
                            state = coverageSourceViewReduce(state, CoverageSourceViewEvent.Filter(filter))
                            onFilterChange(filter)
                        },
                        label = {
                            Text(
                                text = filter.name.take(3),
                                fontSize = 10.sp
                            )
                        }
                    )
                }
            }
        }

        // Source lines as compact chips
        itemsIndexed(filteredLines) { index, line ->
            val isSelected = selectedLineIndex == index
            val statusChar = when (line.coverage) {
                CoverageStatus.Covered -> "\u2713"
                CoverageStatus.Uncovered -> "\u2717"
                CoverageStatus.Partial -> "\u25D0"
                null -> " "
            }
            val gutterColor = line.coverage?.let { gutterColors[it] } ?: Color.Transparent

            Chip(
                onClick = {
                    selectedLineIndex = index
                    state = coverageSourceViewReduce(state, CoverageSourceViewEvent.SelectLine(index))
                    onLineSelect(line)
                },
                label = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(16.dp)
                                .background(gutterColor)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "${line.number}",
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = line.text,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                },
                secondaryLabel = if (isSelected && line.coveredBy != null) {
                    { Text("By: ${line.coveredBy}", fontSize = 9.sp) }
                } else null
            )
        }

        // Selected line detail
        selectedLineIndex?.let { idx ->
            filteredLines.getOrNull(idx)?.let { line ->
                item {
                    Chip(
                        onClick = {
                            selectedLineIndex = null
                            state = coverageSourceViewReduce(state, CoverageSourceViewEvent.Deselect)
                        },
                        label = {
                            Text(
                                text = "L${line.number}: ${line.coverage?.name ?: "N/A"}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 11.sp
                            )
                        },
                        secondaryLabel = line.coveredBy?.let {
                            { Text("Covered by: $it", fontSize = 9.sp) }
                        }
                    )
                }
            }
        }
    }
}
