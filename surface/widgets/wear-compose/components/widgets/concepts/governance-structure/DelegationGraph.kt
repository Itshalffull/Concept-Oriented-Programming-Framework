package com.clef.surface.widgets.concepts.governancestructure

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

enum class DelegationGraphState { Browsing, Selected }

sealed class DelegationGraphEvent {
    data class SelectNode(val nodeId: String) : DelegationGraphEvent()
    object Deselect : DelegationGraphEvent()
}

fun delegationGraphReduce(
    state: DelegationGraphState,
    event: DelegationGraphEvent
): DelegationGraphState = when (state) {
    DelegationGraphState.Browsing -> when (event) {
        is DelegationGraphEvent.SelectNode -> DelegationGraphState.Selected
        else -> state
    }
    DelegationGraphState.Selected -> when (event) {
        is DelegationGraphEvent.Deselect -> DelegationGraphState.Browsing
        is DelegationGraphEvent.SelectNode -> DelegationGraphState.Selected
    }
}

// --- Public types ---

data class DelegationNode(
    val id: String,
    val label: String,
    val votingPower: Float = 0f,
    val avatarUrl: String? = null
)

data class DelegationEdge(
    val from: String,
    val to: String,
    val weight: Float = 1f,
    val topic: String? = null
)

@Composable
fun DelegationGraph(
    nodes: List<DelegationNode>,
    edges: List<DelegationEdge>,
    modifier: Modifier = Modifier,
    onNodeSelect: (DelegationNode) -> Unit = {}
) {
    var state by remember { mutableStateOf(DelegationGraphState.Browsing) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val nodeMap = remember(nodes) { nodes.associateBy { it.id } }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Delegation graph" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Delegates (${nodes.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(nodes) { node ->
            val isSelected = selectedId == node.id
            val delegatesTo = edges.filter { it.from == node.id }
            val receivesFrom = edges.filter { it.to == node.id }

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else node.id
                    selectedId = nextId
                    state = delegationGraphReduce(
                        state,
                        if (nextId != null) DelegationGraphEvent.SelectNode(nextId)
                        else DelegationGraphEvent.Deselect
                    )
                    onNodeSelect(node)
                },
                label = {
                    Text(
                        text = node.label,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text("Power: ${node.votingPower}", style = MaterialTheme.typography.labelSmall)
                            if (delegatesTo.isNotEmpty()) {
                                val targets = delegatesTo.mapNotNull { nodeMap[it.to]?.label }
                                Text(
                                    "\u2192 ${targets.joinToString(", ")}",
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            if (receivesFrom.isNotEmpty()) {
                                Text(
                                    "${receivesFrom.size} delegators",
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                } else {
                    { Text("Power: ${node.votingPower}", style = MaterialTheme.typography.labelSmall) }
                }
            )
        }
    }
}
