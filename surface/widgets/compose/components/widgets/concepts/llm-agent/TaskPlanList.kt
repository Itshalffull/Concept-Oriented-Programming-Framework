package com.clef.surface.widgets.concepts.llmagent

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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

enum class TaskPlanListState { Idle, TaskSelected, Reordering }

sealed class TaskPlanListEvent {
    data class SelectTask(val id: String) : TaskPlanListEvent()
    object Deselect : TaskPlanListEvent()
    object StartReorder : TaskPlanListEvent()
    object EndReorder : TaskPlanListEvent()
}

fun taskPlanListReduce(state: TaskPlanListState, event: TaskPlanListEvent): TaskPlanListState = when (state) {
    TaskPlanListState.Idle -> when (event) {
        is TaskPlanListEvent.SelectTask -> TaskPlanListState.TaskSelected
        is TaskPlanListEvent.StartReorder -> TaskPlanListState.Reordering
        else -> state
    }
    TaskPlanListState.TaskSelected -> when (event) {
        is TaskPlanListEvent.Deselect -> TaskPlanListState.Idle
        is TaskPlanListEvent.SelectTask -> TaskPlanListState.TaskSelected
        else -> state
    }
    TaskPlanListState.Reordering -> when (event) {
        is TaskPlanListEvent.EndReorder -> TaskPlanListState.Idle
        else -> state
    }
}

// --- Types ---

enum class TaskStatus(val icon: String, val label: String) {
    Pending("\u25CB", "Pending"),
    Running("\u25CF", "Running"),
    Complete("\u2713", "Complete"),
    Failed("\u2717", "Failed"),
    Skipped("\u2298", "Skipped")
}

data class Task(
    val id: String,
    val label: String,
    val status: TaskStatus = TaskStatus.Pending,
    val result: String? = null,
    val subtasks: List<Task> = emptyList()
)

// --- Helpers ---

private fun flattenTasks(tasks: List<Task>, expandedIds: Set<String>, depth: Int = 0): List<Pair<Task, Int>> {
    val result = mutableListOf<Pair<Task, Int>>()
    for (task in tasks) {
        result.add(task to depth)
        if (task.id in expandedIds && task.subtasks.isNotEmpty()) {
            result.addAll(flattenTasks(task.subtasks, expandedIds, depth + 1))
        }
    }
    return result
}

private fun countTasks(tasks: List<Task>): Pair<Int, Int> {
    var total = 0
    var complete = 0
    fun walk(t: List<Task>) {
        for (task in t) {
            total++
            if (task.status == TaskStatus.Complete) complete++
            walk(task.subtasks)
        }
    }
    walk(tasks)
    return total to complete
}

@Composable
fun TaskPlanList(
    tasks: List<Task>,
    modifier: Modifier = Modifier,
    goalDescription: String? = null,
    onSelectTask: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(TaskPlanListState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var expandedIds by remember { mutableStateOf(emptySet<String>()) }

    val flatList = remember(tasks, expandedIds) { flattenTasks(tasks, expandedIds) }
    val (totalCount, completeCount) = remember(tasks) { countTasks(tasks) }
    val progress = if (totalCount > 0) completeCount.toFloat() / totalCount else 0f

    fun handleSelect(id: String) {
        val nextId = if (id == selectedId) null else id
        selectedId = nextId
        onSelectTask(nextId)
        state = if (nextId != null) taskPlanListReduce(state, TaskPlanListEvent.SelectTask(nextId))
        else taskPlanListReduce(state, TaskPlanListEvent.Deselect)
    }

    Column(modifier = modifier.semantics { contentDescription = "Task plan list" }) {
        // Goal header
        goalDescription?.let {
            Text(it, fontWeight = FontWeight.Bold, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp))
        }

        // Progress bar
        Column(Modifier.padding(horizontal = 12.dp, vertical = 4.dp)) {
            LinearProgressIndicator(progress = { progress }, modifier = Modifier.fillMaxWidth())
            Text("$completeCount / $totalCount tasks complete", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
        }

        HorizontalDivider()

        // Task list
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(flatList, key = { it.first.id }) { (task, depth) ->
                val isSelected = task.id == selectedId
                val hasSubtasks = task.subtasks.isNotEmpty()
                val isExpanded = task.id in expandedIds

                val statusColor = when (task.status) {
                    TaskStatus.Complete -> MaterialTheme.colorScheme.primary
                    TaskStatus.Running -> MaterialTheme.colorScheme.tertiary
                    TaskStatus.Failed -> MaterialTheme.colorScheme.error
                    else -> MaterialTheme.colorScheme.onSurfaceVariant
                }

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { handleSelect(task.id) }
                        .padding(start = (12 + depth * 20).dp, end = 12.dp, top = 4.dp, bottom = 4.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (hasSubtasks) {
                            TextButton(
                                onClick = { expandedIds = if (isExpanded) expandedIds - task.id else expandedIds + task.id },
                                contentPadding = PaddingValues(0.dp),
                                modifier = Modifier.size(24.dp)
                            ) { Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp) }
                        } else {
                            Spacer(Modifier.size(24.dp))
                        }

                        Text(task.status.icon, color = statusColor, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 4.dp))
                        Text(
                            task.label,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Text(task.status.label, fontSize = 11.sp, color = statusColor)
                    }

                    // Result when selected
                    if (isSelected && task.result != null) {
                        Text(task.result, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 28.dp, top = 2.dp))
                    }
                }
            }
        }
    }
}
