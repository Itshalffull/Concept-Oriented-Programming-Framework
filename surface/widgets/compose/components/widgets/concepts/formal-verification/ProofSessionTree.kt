package com.clef.surface.widgets.concepts.formalverification

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

enum class ProofSessionTreeState { Idle, Selected, Ready, Fetching }

sealed class ProofSessionTreeEvent {
    object Select : ProofSessionTreeEvent()
    object Expand : ProofSessionTreeEvent()
    object Collapse : ProofSessionTreeEvent()
    object Deselect : ProofSessionTreeEvent()
    object LoadChildren : ProofSessionTreeEvent()
    object LoadComplete : ProofSessionTreeEvent()
    object LoadError : ProofSessionTreeEvent()
}

fun proofSessionTreeReduce(state: ProofSessionTreeState, event: ProofSessionTreeEvent): ProofSessionTreeState = when (state) {
    ProofSessionTreeState.Idle -> when (event) {
        is ProofSessionTreeEvent.Select -> ProofSessionTreeState.Selected
        is ProofSessionTreeEvent.Expand -> ProofSessionTreeState.Idle
        is ProofSessionTreeEvent.Collapse -> ProofSessionTreeState.Idle
        else -> state
    }
    ProofSessionTreeState.Selected -> when (event) {
        is ProofSessionTreeEvent.Deselect -> ProofSessionTreeState.Idle
        is ProofSessionTreeEvent.Select -> ProofSessionTreeState.Selected
        else -> state
    }
    ProofSessionTreeState.Ready -> when (event) {
        is ProofSessionTreeEvent.LoadChildren -> ProofSessionTreeState.Fetching
        else -> state
    }
    ProofSessionTreeState.Fetching -> when (event) {
        is ProofSessionTreeEvent.LoadComplete -> ProofSessionTreeState.Ready
        is ProofSessionTreeEvent.LoadError -> ProofSessionTreeState.Ready
        else -> state
    }
}

// --- Types ---

data class ProofGoal(
    val id: String,
    val label: String,
    val status: ProofGoalStatus,
    val tactic: String? = null,
    val children: List<ProofGoal>? = null,
    val progress: Float? = null
)

enum class ProofGoalStatus(val icon: String, val displayLabel: String) {
    Open("\u25CB", "Open"),
    Proved("\u2713", "Proved"),
    Failed("\u2717", "Failed"),
    Skipped("\u2298", "Skipped")
}

// --- Helpers ---

private fun flattenVisible(goals: List<ProofGoal>, expandedSet: Set<String>): List<Pair<ProofGoal, Int>> {
    val result = mutableListOf<Pair<ProofGoal, Int>>()
    fun walk(nodes: List<ProofGoal>, depth: Int) {
        for (goal in nodes) {
            result.add(goal to depth)
            if (!goal.children.isNullOrEmpty() && goal.id in expandedSet) {
                walk(goal.children, depth + 1)
            }
        }
    }
    walk(goals, 0)
    return result
}

private fun findGoal(goals: List<ProofGoal>, id: String): ProofGoal? {
    for (goal in goals) {
        if (goal.id == id) return goal
        if (!goal.children.isNullOrEmpty()) {
            val found = findGoal(goal.children, id)
            if (found != null) return found
        }
    }
    return null
}

private fun countGoals(goals: List<ProofGoal>): Pair<Int, Int> {
    var total = 0
    var proved = 0
    fun walk(nodes: List<ProofGoal>) {
        for (goal in nodes) {
            total++
            if (goal.status == ProofGoalStatus.Proved) proved++
            if (!goal.children.isNullOrEmpty()) walk(goal.children)
        }
    }
    walk(goals)
    return total to proved
}

@Composable
fun ProofSessionTree(
    goals: List<ProofGoal>,
    modifier: Modifier = Modifier,
    selectedId: String? = null,
    expandedIds: Set<String>? = null,
    onSelectGoal: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(ProofSessionTreeState.Idle) }
    var internalSelectedId by remember { mutableStateOf<String?>(null) }
    val currentSelectedId = selectedId ?: internalSelectedId
    var internalExpandedIds by remember { mutableStateOf(expandedIds ?: emptySet()) }
    val currentExpandedIds = expandedIds ?: internalExpandedIds

    val flatList = remember(goals, currentExpandedIds) { flattenVisible(goals, currentExpandedIds) }
    val (total, proved) = remember(goals) { countGoals(goals) }
    val selectedGoal = remember(currentSelectedId, goals) {
        currentSelectedId?.let { findGoal(goals, it) }
    }

    fun handleSelect(id: String) {
        val nextId = if (id == currentSelectedId) null else id
        internalSelectedId = nextId
        onSelectGoal(nextId)
        state = if (nextId != null) ProofSessionTreeState.Selected else ProofSessionTreeState.Idle
    }

    fun handleToggleExpand(id: String) {
        internalExpandedIds = if (id in internalExpandedIds) {
            internalExpandedIds - id
        } else {
            internalExpandedIds + id
        }
    }

    Column(modifier = modifier.semantics { contentDescription = "Proof session tree" }) {
        // Summary
        Text(
            "$proved of $total goals proved",
            style = MaterialTheme.typography.titleSmall,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        )

        HorizontalDivider()

        // Tree items
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(flatList, key = { it.first.id }) { (goal, depth) ->
                val hasChildren = !goal.children.isNullOrEmpty()
                val isExpanded = goal.id in currentExpandedIds
                val isSelected = goal.id == currentSelectedId

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { handleSelect(goal.id) }
                        .padding(start = (depth * 20).dp, end = 8.dp, top = 2.dp, bottom = 2.dp)
                ) {
                    // Expand/collapse trigger
                    if (hasChildren) {
                        TextButton(
                            onClick = { handleToggleExpand(goal.id) },
                            contentPadding = PaddingValues(0.dp),
                            modifier = Modifier.size(24.dp)
                        ) {
                            Text(if (isExpanded) "\u25BC" else "\u25B6", fontSize = 10.sp)
                        }
                    } else {
                        Spacer(Modifier.size(24.dp))
                    }

                    // Status badge
                    Text(
                        goal.status.icon,
                        fontSize = 14.sp,
                        color = when (goal.status) {
                            ProofGoalStatus.Proved -> MaterialTheme.colorScheme.primary
                            ProofGoalStatus.Failed -> MaterialTheme.colorScheme.error
                            ProofGoalStatus.Open -> MaterialTheme.colorScheme.onSurfaceVariant
                            ProofGoalStatus.Skipped -> MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        modifier = Modifier.padding(horizontal = 4.dp)
                    )

                    // Label
                    Text(
                        goal.label,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 14.sp,
                        modifier = Modifier.weight(1f)
                    )

                    // Progress bar
                    goal.progress?.let { p ->
                        Text(
                            "${(p * 100).toInt()}%",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // Detail panel
        selectedGoal?.let { goal ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${goal.status.icon} ${goal.status.displayLabel}", fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = {
                        internalSelectedId = null
                        onSelectGoal(null)
                        state = ProofSessionTreeState.Idle
                    }) {
                        Text("\u2715")
                    }
                }
                Text("Goal: ${goal.label}", fontSize = 13.sp)
                goal.tactic?.let { Text("Tactic: $it", fontSize = 13.sp) }
                goal.progress?.let { Text("Progress: ${(it * 100).toInt()}%", fontSize = 13.sp) }
                if (!goal.children.isNullOrEmpty()) {
                    Text("Sub-goals: ${goal.children.size} goals", fontSize = 13.sp)
                }
            }
        }
    }
}
