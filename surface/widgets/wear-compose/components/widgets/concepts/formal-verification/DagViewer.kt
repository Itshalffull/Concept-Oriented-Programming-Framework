package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class DagViewerState { Idle, NodeSelected }

sealed class DagViewerEvent {
    data class SelectNode(val id: String) : DagViewerEvent()
    object Deselect : DagViewerEvent()
}

fun dagViewerReduce(
    state: DagViewerState,
    event: DagViewerEvent
): DagViewerState = when (state) {
    DagViewerState.Idle -> when (event) {
        is DagViewerEvent.SelectNode -> DagViewerState.NodeSelected
        else -> state
    }
    DagViewerState.NodeSelected -> when (event) {
        is DagViewerEvent.Deselect -> DagViewerState.Idle
        is DagViewerEvent.SelectNode -> DagViewerState.NodeSelected
    }
}

// --- Types ---

data class DagNode(
    val id: String,
    val label: String,
    val type: String? = null,
    val status: String? = null
)

data class DagEdge(
    val from: String,
    val to: String,
    val label: String? = null
)

@Composable
fun DagViewer(
    nodes: List<DagNode>,
    edges: List<DagEdge>,
    modifier: Modifier = Modifier,
    selectedNodeId: String? = null,
    onSelectNode: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(DagViewerState.Idle) }
    var internalSelectedId by remember { mutableStateOf<String?>(null) }
    val activeSelectedId = selectedNodeId ?: internalSelectedId

    val nodeMap = remember(nodes) { nodes.associateBy { it.id } }

    val upstream = remember(activeSelectedId, edges) {
        if (activeSelectedId == null) emptySet()
        else edges.filter { it.to == activeSelectedId }.map { it.from }.toSet()
    }
    val downstream = remember(activeSelectedId, edges) {
        if (activeSelectedId == null) emptySet()
        else edges.filter { it.from == activeSelectedId }.map { it.to }.toSet()
    }

    // Topological level computation
    val levels = remember(nodes, edges) {
        val inDegree = mutableMapOf<String, Int>()
        val children = mutableMapOf<String, MutableList<String>>()
        nodes.forEach { inDegree[it.id] = 0; children[it.id] = mutableListOf() }
        edges.forEach { e ->
            inDegree[e.to] = (inDegree[e.to] ?: 0) + 1
            children[e.from]?.add(e.to)
        }
        val result = mutableMapOf<String, Int>()
        val queue = ArrayDeque<String>()
        inDegree.forEach { (id, deg) -> if (deg == 0) { queue.add(id); result[id] = 0 } }
        while (queue.isNotEmpty()) {
            val current = queue.removeFirst()
            val lvl = result[current] ?: 0
            children[current]?.forEach { child ->
                val next = lvl + 1
                if ((result[child] ?: -1) < next) result[child] = next
                val newDeg = (inDegree[child] ?: 1) - 1
                inDegree[child] = newDeg
                if (newDeg == 0) queue.add(child)
            }
        }
        nodes.forEach { if (it.id !in result) result[it.id] = 0 }
        result
    }

    val sortedNodes = remember(nodes, levels) {
        nodes.sortedBy { levels[it.id] ?: 0 }
    }

    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier.fillMaxSize(),
        state = listState
    ) {
        item {
            ListHeader { Text("DAG (${nodes.size} nodes)") }
        }

        items(sortedNodes, key = { it.id }) { node ->
            val isSelected = node.id == activeSelectedId
            val level = levels[node.id] ?: 0
            val isHighlighted = isSelected || node.id in upstream || node.id in downstream

            Chip(
                onClick = {
                    val newId = if (isSelected) null else node.id
                    internalSelectedId = newId
                    onSelectNode(newId)
                    state = if (newId != null)
                        dagViewerReduce(state, DagViewerEvent.SelectNode(newId))
                    else
                        dagViewerReduce(state, DagViewerEvent.Deselect)
                },
                label = {
                    Text(
                        text = "${"  ".repeat(level)}${node.label}",
                        fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 12.sp,
                        maxLines = 1
                    )
                },
                secondaryLabel = {
                    Text("${node.type ?: ""} \u2022 ${node.status ?: "unknown"}", fontSize = 10.sp)
                }
            )
        }

        // Detail panel for selected node
        activeSelectedId?.let { selId ->
            nodeMap[selId]?.let { selected ->
                item {
                    ListHeader { Text("Details", fontSize = 11.sp) }
                }
                item {
                    Chip(
                        onClick = {},
                        label = { Text(selected.label, fontWeight = FontWeight.Bold, fontSize = 12.sp) },
                        secondaryLabel = {
                            Text("Type: ${selected.type ?: "N/A"} | Status: ${selected.status ?: "unknown"}", fontSize = 9.sp)
                        }
                    )
                }
                if (upstream.isNotEmpty()) {
                    item {
                        Chip(
                            onClick = {},
                            label = { Text("\u2191 Upstream (${upstream.size})", fontSize = 11.sp) },
                            secondaryLabel = {
                                Text(upstream.mapNotNull { nodeMap[it]?.label }.joinToString(", "), fontSize = 9.sp)
                            }
                        )
                    }
                }
                if (downstream.isNotEmpty()) {
                    item {
                        Chip(
                            onClick = {},
                            label = { Text("\u2193 Downstream (${downstream.size})", fontSize = 11.sp) },
                            secondaryLabel = {
                                Text(downstream.mapNotNull { nodeMap[it]?.label }.joinToString(", "), fontSize = 9.sp)
                            }
                        )
                    }
                }
            }
        }
    }
}
