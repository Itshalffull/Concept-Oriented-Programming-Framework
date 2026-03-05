package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class DagViewerState { Idle, NodeSelected, Computing }

sealed class DagViewerEvent {
    data class SelectNode(val id: String?) : DagViewerEvent()
    object Deselect : DagViewerEvent()
    object Layout : DagViewerEvent()
    object LayoutComplete : DagViewerEvent()
}

fun dagViewerReduce(state: DagViewerState, event: DagViewerEvent): DagViewerState = when (state) {
    DagViewerState.Idle -> when (event) {
        is DagViewerEvent.SelectNode -> DagViewerState.NodeSelected
        is DagViewerEvent.Layout -> DagViewerState.Computing
        else -> state
    }
    DagViewerState.NodeSelected -> when (event) {
        is DagViewerEvent.Deselect -> DagViewerState.Idle
        is DagViewerEvent.SelectNode -> DagViewerState.NodeSelected
        else -> state
    }
    DagViewerState.Computing -> when (event) {
        is DagViewerEvent.LayoutComplete -> DagViewerState.Idle
        else -> state
    }
}

data class DagNode(val id: String, val label: String, val type: String? = null, val status: String? = null)
data class DagEdge(val from: String, val to: String, val label: String? = null)

private fun computeLevels(nodes: List<DagNode>, edges: List<DagEdge>): Map<String, Int> {
    val inDegree = mutableMapOf<String, Int>()
    val children = mutableMapOf<String, MutableList<String>>()
    nodes.forEach { inDegree[it.id] = 0; children[it.id] = mutableListOf() }
    edges.forEach { e -> inDegree[e.to] = (inDegree[e.to] ?: 0) + 1; children[e.from]?.add(e.to) }
    val levels = mutableMapOf<String, Int>()
    val queue = ArrayDeque<String>()
    inDegree.forEach { (id, deg) -> if (deg == 0) { queue.add(id); levels[id] = 0 } }
    while (queue.isNotEmpty()) {
        val cur = queue.removeFirst()
        val curLvl = levels[cur]!!
        for (child in children[cur] ?: emptyList()) {
            val next = curLvl + 1
            if ((levels[child] ?: -1) < next) levels[child] = next
            inDegree[child] = (inDegree[child] ?: 1) - 1
            if (inDegree[child] == 0) queue.add(child)
        }
    }
    nodes.forEach { if (it.id !in levels) levels[it.id] = 0 }
    return levels
}

private fun groupByLevel(nodes: List<DagNode>, levels: Map<String, Int>): List<List<DagNode>> {
    val max = levels.values.maxOrNull() ?: 0
    val groups = List(max + 1) { mutableListOf<DagNode>() }
    nodes.forEach { groups[levels[it.id] ?: 0].add(it) }
    return groups
}

@Composable
fun DagViewer(
    nodes: List<DagNode>,
    edges: List<DagEdge>,
    modifier: Modifier = Modifier,
    layout: String = "dagre",
    selectedNodeId: String? = null,
    onSelectNode: (String?) -> Unit = {}
) {
    var state by remember { mutableStateOf(DagViewerState.Idle) }
    var internalSelected by remember { mutableStateOf<String?>(null) }
    val selected = selectedNodeId ?: internalSelected
    val levels = remember(nodes, edges) { computeLevels(nodes, edges) }
    val groups = remember(nodes, levels) { groupByLevel(nodes, levels) }
    val nodeMap = remember(nodes) { nodes.associateBy { it.id } }
    val upstream = remember(selected, edges) { selected?.let { s -> edges.filter { it.to == s }.map { it.from }.toSet() } ?: emptySet() }
    val downstream = remember(selected, edges) { selected?.let { s -> edges.filter { it.from == s }.map { it.to }.toSet() } ?: emptySet() }

    fun select(id: String?) {
        internalSelected = id; onSelectNode(id)
        state = if (id != null) DagViewerState.NodeSelected else DagViewerState.Idle
    }

    Column(modifier = modifier.semantics { contentDescription = "Dependency graph" }) {
        LazyColumn(modifier = Modifier.weight(1f)) {
            groups.forEachIndexed { lvl, group ->
                item("lvl-$lvl") { Text("Level $lvl", style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(8.dp)) }
                items(group, key = { it.id }) { node ->
                    val isSel = node.id == selected
                    OutlinedCard(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp)
                            .clickable { select(if (isSel) null else node.id) },
                        colors = CardDefaults.outlinedCardColors(
                            containerColor = when {
                                isSel -> MaterialTheme.colorScheme.primaryContainer
                                node.id in upstream || node.id in downstream -> MaterialTheme.colorScheme.secondaryContainer
                                else -> MaterialTheme.colorScheme.surface
                            }
                        )
                    ) {
                        Row(Modifier.padding(8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(node.label, fontWeight = FontWeight.Medium)
                            node.type?.let { Text(it, fontSize = 11.sp, color = MaterialTheme.colorScheme.primary) }
                            Text(node.status ?: "unknown", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
            items(edges, key = { "${it.from}-${it.to}" }) { edge ->
                Text("${nodeMap[edge.from]?.label ?: edge.from} \u2192 ${nodeMap[edge.to]?.label ?: edge.to}${edge.label?.let { " ($it)" } ?: ""}", fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 2.dp))
            }
        }
        selected?.let { id -> nodeMap[id]?.let { n ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text(n.label, fontWeight = FontWeight.Bold)
                n.type?.let { Text("Type: $it", fontSize = 13.sp) }
                Text("Status: ${n.status ?: "unknown"}", fontSize = 13.sp)
                Text("Upstream: ${upstream.joinToString { nodeMap[it]?.label ?: it }}", fontSize = 13.sp)
                Text("Downstream: ${downstream.joinToString { nodeMap[it]?.label ?: it }}", fontSize = 13.sp)
            }
        }}
    }
}
