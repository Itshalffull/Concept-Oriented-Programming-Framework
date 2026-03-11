package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class StatusGridState { Idle, CellHovered, CellSelected }

sealed class StatusGridEvent {
    data class HoverCell(val index: Int) : StatusGridEvent()
    data class ClickCell(val index: Int) : StatusGridEvent()
    object Sort : StatusGridEvent()
    object Filter : StatusGridEvent()
    object LeaveCell : StatusGridEvent()
    object Deselect : StatusGridEvent()
}

fun statusGridReduce(state: StatusGridState, event: StatusGridEvent): StatusGridState = when (state) {
    StatusGridState.Idle -> when (event) {
        is StatusGridEvent.HoverCell -> StatusGridState.CellHovered
        is StatusGridEvent.ClickCell -> StatusGridState.CellSelected
        is StatusGridEvent.Sort -> StatusGridState.Idle
        is StatusGridEvent.Filter -> StatusGridState.Idle
        else -> state
    }
    StatusGridState.CellHovered -> when (event) {
        is StatusGridEvent.LeaveCell -> StatusGridState.Idle
        is StatusGridEvent.ClickCell -> StatusGridState.CellSelected
        else -> state
    }
    StatusGridState.CellSelected -> when (event) {
        is StatusGridEvent.Deselect -> StatusGridState.Idle
        is StatusGridEvent.ClickCell -> StatusGridState.CellSelected
        else -> state
    }
}

// --- Types ---

enum class CellStatus(val label: String, val color: Color) {
    Passed("Passed", Color(0xFF22C55E)),
    Failed("Failed", Color(0xFFEF4444)),
    Running("Running", Color(0xFF3B82F6)),
    Pending("Pending", Color(0xFF9CA3AF)),
    Timeout("Timeout", Color(0xFFF97316))
}

data class StatusGridItem(
    val id: String,
    val name: String,
    val status: CellStatus,
    val duration: Long? = null
)

enum class StatusFilterValue { All, Passed, Failed }

private fun formatDuration(ms: Long): String =
    if (ms < 1000) "${ms}ms" else "${(ms / 1000.0).let { "%.1f".format(it) }}s"

@Composable
fun StatusGrid(
    items: List<StatusGridItem>,
    modifier: Modifier = Modifier,
    columns: Int = 4,
    showAggregates: Boolean = true,
    variant: String = "expanded",
    filterStatus: StatusFilterValue = StatusFilterValue.All,
    onCellSelect: (StatusGridItem) -> Unit = {}
) {
    var state by remember { mutableStateOf(StatusGridState.Idle) }
    var filter by remember { mutableStateOf(filterStatus) }
    var selectedIndex by remember { mutableStateOf<Int?>(null) }

    val filteredItems = remember(items, filter) {
        when (filter) {
            StatusFilterValue.All -> items
            StatusFilterValue.Passed -> items.filter { it.status == CellStatus.Passed }
            StatusFilterValue.Failed -> items.filter { it.status == CellStatus.Failed }
        }
    }

    val counts = remember(items) {
        CellStatus.entries.associateWith { status -> items.count { it.status == status } }
    }

    val summaryText = remember(counts) {
        counts.filter { it.value > 0 }.entries.joinToString(", ") { "${it.value} ${it.key.label.lowercase()}" }
    }

    val selectedItem = selectedIndex?.let { filteredItems.getOrNull(it) }
    val isCompact = variant == "compact"

    Column(modifier = modifier.semantics { contentDescription = "Verification status matrix" }) {
        // Summary bar
        if (showAggregates) {
            Text(
                summaryText,
                fontSize = if (isCompact) 12.sp else 14.sp,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        // Filter buttons
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            StatusFilterValue.entries.forEach { value ->
                FilterChip(
                    selected = filter == value,
                    onClick = {
                        filter = value
                        selectedIndex = null
                        state = StatusGridState.Idle
                    },
                    label = { Text(value.name, fontSize = if (isCompact) 11.sp else 13.sp) }
                )
            }
        }

        // Grid of cells
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            horizontalArrangement = Arrangement.spacedBy(if (isCompact) 2.dp else 4.dp),
            verticalArrangement = Arrangement.spacedBy(if (isCompact) 2.dp else 4.dp),
            modifier = Modifier.weight(1f).padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            itemsIndexed(filteredItems, key = { _, item -> item.id }) { index, item ->
                val isSelected = selectedIndex == index
                OutlinedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedIndex = index
                            state = StatusGridState.CellSelected
                            onCellSelect(item)
                        }
                        .then(
                            if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small)
                            else Modifier
                        )
                ) {
                    Column(
                        horizontalAlignment = if (isCompact) Alignment.CenterHorizontally else Alignment.Start,
                        modifier = Modifier.padding(if (isCompact) 4.dp else 8.dp)
                    ) {
                        // Status indicator dot
                        Box(
                            modifier = Modifier
                                .size(if (isCompact) 10.dp else 14.dp)
                                .clip(CircleShape)
                                .background(item.status.color)
                        )
                        Spacer(Modifier.height(if (isCompact) 2.dp else 4.dp))
                        // Name
                        Text(
                            item.name,
                            fontSize = if (isCompact) 10.sp else 12.sp,
                            maxLines = 1
                        )
                        // Duration (expanded only)
                        if (!isCompact && item.duration != null) {
                            Text(
                                formatDuration(item.duration),
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(top = 2.dp)
                            )
                        }
                    }
                }
            }
        }

        // Detail panel for selected cell
        selectedItem?.let { item ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text(item.name, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(item.status.color)
                    )
                    Text("Status: ${item.status.label}", fontSize = 13.sp)
                }
                item.duration?.let {
                    Text("Duration: ${formatDuration(it)}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
