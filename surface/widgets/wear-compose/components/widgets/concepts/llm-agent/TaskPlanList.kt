package com.clef.surface.widgets.concepts.llmagent

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

enum class TaskPlanListState { Idle, TaskSelected }

sealed class TaskPlanListEvent {
    data class SelectTask(val taskId: String) : TaskPlanListEvent()
    object Deselect : TaskPlanListEvent()
}

fun taskPlanListReduce(
    state: TaskPlanListState,
    event: TaskPlanListEvent
): TaskPlanListState = when (state) {
    TaskPlanListState.Idle -> when (event) {
        is TaskPlanListEvent.SelectTask -> TaskPlanListState.TaskSelected
        else -> state
    }
    TaskPlanListState.TaskSelected -> when (event) {
        is TaskPlanListEvent.Deselect -> TaskPlanListState.Idle
        is TaskPlanListEvent.SelectTask -> TaskPlanListState.TaskSelected
    }
}

// --- Public types ---

enum class TaskStatus { Pending, Active, Complete, Failed, Skipped }

data class Task(
    val id: String,
    val label: String,
    val status: TaskStatus,
    val description: String? = null,
    val subtasks: List<Task> = emptyList()
)

private val STATUS_ICONS = mapOf(
    TaskStatus.Pending to "\u25CB",
    TaskStatus.Active to "\u25B6",
    TaskStatus.Complete to "\u2713",
    TaskStatus.Failed to "\u2717",
    TaskStatus.Skipped to "\u2298"
)

private val STATUS_COLORS = mapOf(
    TaskStatus.Pending to Color(0xFF9CA3AF),
    TaskStatus.Active to Color(0xFF3B82F6),
    TaskStatus.Complete to Color(0xFF22C55E),
    TaskStatus.Failed to Color(0xFFEF4444),
    TaskStatus.Skipped to Color(0xFF6B7280)
)

@Composable
fun TaskPlanList(
    tasks: List<Task>,
    modifier: Modifier = Modifier,
    onSelectTask: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(TaskPlanListState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val completed = tasks.count { it.status == TaskStatus.Complete }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Task plan list" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Tasks $completed/${tasks.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(tasks) { task ->
            val icon = STATUS_ICONS[task.status] ?: "\u25CB"
            val color = STATUS_COLORS[task.status] ?: Color.Gray
            val isSelected = selectedId == task.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else task.id
                    selectedId = nextId
                    state = taskPlanListReduce(
                        state,
                        if (nextId != null) TaskPlanListEvent.SelectTask(nextId)
                        else TaskPlanListEvent.Deselect
                    )
                    if (nextId != null) onSelectTask(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${task.label}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected && task.description != null) {
                    { Text(task.description, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                } else null
            )
        }
    }
}
