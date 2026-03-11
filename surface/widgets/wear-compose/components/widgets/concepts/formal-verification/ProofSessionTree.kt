package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

enum class ProofSessionTreeState { Idle, Selected }

sealed class ProofSessionTreeEvent {
    data class Select(val goalId: String) : ProofSessionTreeEvent()
    object Deselect : ProofSessionTreeEvent()
    data class Expand(val goalId: String) : ProofSessionTreeEvent()
    data class Collapse(val goalId: String) : ProofSessionTreeEvent()
}

fun proofSessionTreeReduce(
    state: ProofSessionTreeState,
    event: ProofSessionTreeEvent
): ProofSessionTreeState = when (state) {
    ProofSessionTreeState.Idle -> when (event) {
        is ProofSessionTreeEvent.Select -> ProofSessionTreeState.Selected
        else -> state
    }
    ProofSessionTreeState.Selected -> when (event) {
        is ProofSessionTreeEvent.Deselect -> ProofSessionTreeState.Idle
        is ProofSessionTreeEvent.Select -> ProofSessionTreeState.Selected
        else -> state
    }
}

// --- Public types ---

data class ProofGoal(
    val id: String,
    val label: String,
    val status: String, // open, proved, failed, skipped
    val tactic: String? = null,
    val children: List<ProofGoal> = emptyList(),
    val progress: Float? = null
)

private val STATUS_ICONS = mapOf(
    "proved" to "\u2713",
    "failed" to "\u2717",
    "open" to "\u25CB",
    "skipped" to "\u2298"
)

/** Flatten tree into indented list of (depth, goal) pairs. */
private fun flattenGoals(
    goals: List<ProofGoal>,
    expandedIds: Set<String>,
    depth: Int = 0
): List<Pair<Int, ProofGoal>> {
    val result = mutableListOf<Pair<Int, ProofGoal>>()
    for (goal in goals) {
        result.add(depth to goal)
        if (goal.children.isNotEmpty() && goal.id in expandedIds) {
            result.addAll(flattenGoals(goal.children, expandedIds, depth + 1))
        }
    }
    return result
}

private fun countGoals(goals: List<ProofGoal>): Pair<Int, Int> {
    var total = 0; var proved = 0
    fun walk(nodes: List<ProofGoal>) {
        for (g in nodes) {
            total++
            if (g.status == "proved") proved++
            walk(g.children)
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
    onSelectGoal: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(ProofSessionTreeState.Idle) }
    var expandedIds by remember { mutableStateOf(setOf<String>()) }
    var currentSelectedId by remember { mutableStateOf(selectedId) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(selectedId) { currentSelectedId = selectedId }

    val flatList = remember(goals, expandedIds) { flattenGoals(goals, expandedIds) }
    val (total, proved) = remember(goals) { countGoals(goals) }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Proof session tree" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$proved/$total proved",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(flatList) { (depth, goal) ->
            val isSelected = currentSelectedId == goal.id
            val hasChildren = goal.children.isNotEmpty()
            val isExpanded = goal.id in expandedIds
            val icon = STATUS_ICONS[goal.status] ?: "\u25CB"
            val expandMarker = if (hasChildren) (if (isExpanded) "\u25BC " else "\u25B6 ") else "  "

            Chip(
                onClick = {
                    if (hasChildren) {
                        expandedIds = if (isExpanded) expandedIds - goal.id else expandedIds + goal.id
                    }
                    val nextId = if (isSelected) null else goal.id
                    currentSelectedId = nextId
                    state = proofSessionTreeReduce(
                        state,
                        if (nextId != null) ProofSessionTreeEvent.Select(nextId)
                        else ProofSessionTreeEvent.Deselect
                    )
                    onSelectGoal(nextId)
                },
                label = {
                    Text(
                        text = "$expandMarker$icon ${goal.label}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.labelSmall
                    )
                },
                secondaryLabel = if (isSelected && goal.tactic != null) {
                    { Text("Tactic: ${goal.tactic}", style = MaterialTheme.typography.labelSmall) }
                } else if (goal.progress != null) {
                    { Text("${(goal.progress * 100).toInt()}%", style = MaterialTheme.typography.labelSmall) }
                } else null,
                modifier = Modifier.padding(start = (depth * 12).dp)
            )
        }
    }
}
