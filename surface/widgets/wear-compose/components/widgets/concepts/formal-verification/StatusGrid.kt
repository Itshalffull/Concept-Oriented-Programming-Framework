package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.background
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

enum class StatusGridState { Idle, CellSelected }

sealed class StatusGridEvent {
    data class ClickCell(val itemId: String) : StatusGridEvent()
    object Deselect : StatusGridEvent()
    object Filter : StatusGridEvent()
}

fun statusGridReduce(state: StatusGridState, event: StatusGridEvent): StatusGridState = when (state) {
    StatusGridState.Idle -> when (event) {
        is StatusGridEvent.ClickCell -> StatusGridState.CellSelected
        is StatusGridEvent.Filter -> StatusGridState.Idle
        else -> state
    }
    StatusGridState.CellSelected -> when (event) {
        is StatusGridEvent.Deselect -> StatusGridState.Idle
        is StatusGridEvent.ClickCell -> StatusGridState.CellSelected
        else -> state
    }
}

// --- Public types ---

enum class CellStatus { Passed, Failed, Running, Pending, Timeout }

data class StatusGridItem(
    val id: String,
    val name: String,
    val status: CellStatus,
    val duration: Long? = null
)

private val STATUS_COLORS = mapOf(
    CellStatus.Passed to Color(0xFF22C55E),
    CellStatus.Failed to Color(0xFFEF4444),
    CellStatus.Running to Color(0xFF3B82F6),
    CellStatus.Pending to Color(0xFF9CA3AF),
    CellStatus.Timeout to Color(0xFFF97316)
)

private val STATUS_ICONS = mapOf(
    CellStatus.Passed to "\u2713",
    CellStatus.Failed to "\u2717",
    CellStatus.Running to "\u25B6",
    CellStatus.Pending to "\u25CB",
    CellStatus.Timeout to "\u23F0"
)

@Composable
fun StatusGrid(
    items: List<StatusGridItem>,
    modifier: Modifier = Modifier,
    onCellSelect: (StatusGridItem) -> Unit = {}
) {
    var state by remember { mutableStateOf(StatusGridState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val passed = items.count { it.status == CellStatus.Passed }
    val failed = items.count { it.status == CellStatus.Failed }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Verification status grid" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$passed/${items.size} passed",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (failed > 0) {
            item {
                Text(
                    "$failed failed",
                    color = Color(0xFFEF4444),
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }

        items(items) { item ->
            val icon = STATUS_ICONS[item.status] ?: "\u25CB"
            val color = STATUS_COLORS[item.status] ?: Color.Gray
            val isSelected = selectedId == item.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else item.id
                    selectedId = nextId
                    state = statusGridReduce(
                        state,
                        if (nextId != null) StatusGridEvent.ClickCell(nextId)
                        else StatusGridEvent.Deselect
                    )
                    onCellSelect(item)
                },
                label = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(color)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "$icon ${item.name}",
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                },
                secondaryLabel = if (isSelected && item.duration != null) {
                    { Text("${item.duration}ms", style = MaterialTheme.typography.labelSmall) }
                } else null
            )
        }
    }
}
