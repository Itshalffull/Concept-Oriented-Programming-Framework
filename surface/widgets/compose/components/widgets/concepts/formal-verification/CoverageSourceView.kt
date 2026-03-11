package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class CoverageSourceViewState { Idle, LineHovered }

sealed class CoverageSourceViewEvent {
    data class HoverLine(val lineIndex: Int) : CoverageSourceViewEvent()
    data class Filter(val status: CoverageFilter) : CoverageSourceViewEvent()
    object JumpUncovered : CoverageSourceViewEvent()
    object Leave : CoverageSourceViewEvent()
    data class SelectLine(val lineIndex: Int) : CoverageSourceViewEvent()
}

fun coverageSourceViewReduce(
    state: CoverageSourceViewState,
    event: CoverageSourceViewEvent
): CoverageSourceViewState = when (state) {
    CoverageSourceViewState.Idle -> when (event) {
        is CoverageSourceViewEvent.HoverLine -> CoverageSourceViewState.LineHovered
        is CoverageSourceViewEvent.Filter -> CoverageSourceViewState.Idle
        is CoverageSourceViewEvent.JumpUncovered -> CoverageSourceViewState.Idle
        else -> state
    }
    CoverageSourceViewState.LineHovered -> when (event) {
        is CoverageSourceViewEvent.Leave -> CoverageSourceViewState.Idle
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

// --- Style constants ---

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
    language: String = "typescript",
    showLineNumbers: Boolean = true,
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

    Column(
        modifier = modifier.semantics {
            contentDescription = "Coverage source view"
        }
    ) {
        // Summary header
        Text(
            text = "Coverage: ${summary.percentage}% (${summary.coveredLines}/${summary.totalLines} lines)",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )

        HorizontalDivider()

        // Filter bar
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
        ) {
            CoverageFilter.entries.forEach { filter ->
                FilterChip(
                    selected = activeFilter == filter,
                    onClick = {
                        activeFilter = filter
                        selectedLineIndex = null
                        state = coverageSourceViewReduce(state, CoverageSourceViewEvent.Filter(filter))
                        onFilterChange(filter)
                    },
                    label = { Text(filter.name, fontSize = 12.sp) }
                )
            }
        }

        HorizontalDivider()

        // Scrollable code area
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(filteredLines, key = { _, line -> line.number }) { index, line ->
                val isSelected = selectedLineIndex == index
                val bgColor = when {
                    isSelected -> MaterialTheme.colorScheme.primaryContainer
                    else -> Color.Transparent
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(bgColor)
                        .clickable {
                            selectedLineIndex = index
                            state = coverageSourceViewReduce(state, CoverageSourceViewEvent.SelectLine(index))
                            onLineSelect(line)
                        }
                        .padding(vertical = 1.dp)
                ) {
                    // Coverage gutter
                    Box(
                        modifier = Modifier
                            .width(4.dp)
                            .height(20.dp)
                            .background(
                                line.coverage?.let { gutterColors[it] } ?: Color.Transparent
                            )
                    )

                    // Line number
                    if (showLineNumbers) {
                        Text(
                            text = "${line.number}",
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .width(48.dp)
                                .padding(end = 12.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.End
                        )
                    }

                    // Source text
                    Text(
                        text = line.text,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f).padding(end = 12.dp)
                    )
                }
            }
        }

        // Selected line details
        selectedLineIndex?.let { idx ->
            filteredLines.getOrNull(idx)?.let { line ->
                HorizontalDivider()
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = "Line ${line.number}",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                    Text(
                        text = " \u2014 ${line.coverage?.name ?: "Not executable"}",
                        fontSize = 13.sp
                    )
                    line.coveredBy?.let {
                        Text(text = " (covered by: $it)", fontSize = 13.sp)
                    }
                }
            }
        }
    }
}
