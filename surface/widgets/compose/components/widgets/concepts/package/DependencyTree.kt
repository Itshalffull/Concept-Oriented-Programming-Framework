package com.clef.surface.widgets.concepts.pkg

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class DependencyTreeState { Idle, NodeSelected, Filtering }

sealed class DependencyTreeEvent {
    data class Select(val name: String) : DependencyTreeEvent()
    object Expand : DependencyTreeEvent()
    object Collapse : DependencyTreeEvent()
    object Search : DependencyTreeEvent()
    object FilterScope : DependencyTreeEvent()
    object Deselect : DependencyTreeEvent()
    object Clear : DependencyTreeEvent()
}

fun dependencyTreeReduce(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState = when (state) {
    DependencyTreeState.Idle -> when (event) {
        is DependencyTreeEvent.Select -> DependencyTreeState.NodeSelected
        is DependencyTreeEvent.Expand -> DependencyTreeState.Idle
        is DependencyTreeEvent.Collapse -> DependencyTreeState.Idle
        is DependencyTreeEvent.Search -> DependencyTreeState.Filtering
        is DependencyTreeEvent.FilterScope -> DependencyTreeState.Idle
        else -> state
    }
    DependencyTreeState.NodeSelected -> when (event) {
        is DependencyTreeEvent.Deselect -> DependencyTreeState.Idle
        is DependencyTreeEvent.Select -> DependencyTreeState.NodeSelected
        else -> state
    }
    DependencyTreeState.Filtering -> when (event) {
        is DependencyTreeEvent.Clear -> DependencyTreeState.Idle
        else -> state
    }
}

// --- Types ---

data class DependencyNode(
    val name: String,
    val version: String,
    val type: String = "prod",
    val dependencies: List<DependencyNode> = emptyList()
)

data class DependencyRoot(
    val name: String,
    val version: String,
    val dependencies: List<DependencyNode> = emptyList()
)

// --- Helpers ---

private fun collectPackages(nodes: List<DependencyNode>): Map<String, List<String>> {
    val map = mutableMapOf<String, MutableList<String>>()
    fun walk(deps: List<DependencyNode>) {
        for (dep in deps) {
            map.getOrPut(dep.name) { mutableListOf() }.add(dep.version)
            walk(dep.dependencies)
        }
    }
    walk(nodes)
    return map
}

private fun flattenNodes(nodes: List<DependencyNode>, depth: Int, expandDepth: Int, query: String, scope: String): List<Triple<DependencyNode, Int, Boolean>> {
    val result = mutableListOf<Triple<DependencyNode, Int, Boolean>>()
    for (node in nodes) {
        if (scope != "all" && node.type != scope) continue
        if (query.isNotEmpty() && !node.name.contains(query, ignoreCase = true) && !node.version.contains(query, ignoreCase = true)) continue
        val hasChildren = node.dependencies.isNotEmpty()
        result.add(Triple(node, depth, hasChildren))
        if (hasChildren && depth < expandDepth) {
            result.addAll(flattenNodes(node.dependencies, depth + 1, expandDepth, query, scope))
        }
    }
    return result
}

private val SCOPE_OPTIONS = listOf("all", "prod", "dev", "peer", "optional")

@Composable
fun DependencyTree(
    root: DependencyRoot,
    modifier: Modifier = Modifier,
    expandDepth: Int = 2,
    showDevDeps: Boolean = true
) {
    var state by remember { mutableStateOf(DependencyTreeState.Idle) }
    var searchQuery by remember { mutableStateOf("") }
    var scopeFilter by remember { mutableStateOf("all") }
    var selectedName by remember { mutableStateOf<String?>(null) }

    val deps = remember(root, showDevDeps) {
        if (showDevDeps) root.dependencies else root.dependencies.filter { it.type != "dev" }
    }
    val packageMap = remember(deps) { collectPackages(deps) }
    val flatNodes = remember(deps, expandDepth, searchQuery, scopeFilter) {
        flattenNodes(deps, 0, expandDepth, searchQuery, scopeFilter)
    }
    val selectedNode = remember(selectedName, deps) {
        fun find(nodes: List<DependencyNode>): DependencyNode? {
            for (n in nodes) {
                if (n.name == selectedName) return n
                val found = find(n.dependencies)
                if (found != null) return found
            }
            return null
        }
        selectedName?.let { find(deps) }
    }

    Column(modifier = modifier.semantics { contentDescription = "Dependencies for ${root.name}" }) {
        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                state = if (it.isNotBlank()) dependencyTreeReduce(state, DependencyTreeEvent.Search)
                else dependencyTreeReduce(state, DependencyTreeEvent.Clear)
            },
            placeholder = { Text("Search dependencies\u2026") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(bottom = 4.dp)
        )

        // Scope filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(bottom = 8.dp)) {
            SCOPE_OPTIONS.forEach { scope ->
                FilterChip(
                    selected = scopeFilter == scope,
                    onClick = {
                        scopeFilter = scope
                        state = dependencyTreeReduce(state, DependencyTreeEvent.FilterScope)
                    },
                    label = { Text(scope, fontSize = 11.sp) }
                )
            }
        }

        // Summary
        Text(
            "${flatNodes.size} packages",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(bottom = 4.dp)
        )

        // Tree list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(flatNodes) { _, (node, depth, hasChildren) ->
                val versions = packageMap[node.name] ?: emptyList()
                val isDuplicate = versions.size > 1
                val hasConflict = isDuplicate && versions.toSet().size > 1
                val isSelected = selectedName == node.name

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = (depth * 20).dp, top = 2.dp, bottom = 2.dp)
                        .clickable {
                            if (selectedName == node.name) {
                                selectedName = null
                                state = dependencyTreeReduce(state, DependencyTreeEvent.Deselect)
                            } else {
                                selectedName = node.name
                                state = dependencyTreeReduce(state, DependencyTreeEvent.Select(node.name))
                            }
                        }
                ) {
                    // Expand indicator
                    Text(
                        if (hasChildren) "\u25BE" else " ",
                        fontSize = 12.sp,
                        modifier = Modifier.width(16.dp)
                    )

                    // Package name
                    Text(
                        node.name,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 13.sp
                    )
                    Text("@${node.version}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    Spacer(Modifier.width(6.dp))

                    // Type badge
                    Text(node.type, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

                    // Conflict warning
                    if (hasConflict) {
                        Spacer(Modifier.width(4.dp))
                        Text("\u26A0", fontSize = 12.sp, color = Color(0xFFFFA500))
                    }

                    // Duplicate count
                    if (isDuplicate) {
                        Spacer(Modifier.width(4.dp))
                        Text("x${versions.size}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }

        // Detail panel
        if (state == DependencyTreeState.NodeSelected && selectedNode != null) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text(selectedNode.name, fontWeight = FontWeight.Bold, fontSize = 14.sp)
            Text("Version: ${selectedNode.version}", fontSize = 13.sp)
            Text("Type: ${selectedNode.type}", fontSize = 13.sp)
            if (selectedNode.dependencies.isNotEmpty()) {
                Text("Direct dependencies: ${selectedNode.dependencies.size}", fontSize = 13.sp)
            }
            val versions = packageMap[selectedNode.name] ?: emptyList()
            val uniqueVersions = versions.toSet()
            if (uniqueVersions.size > 1) {
                Text(
                    "Version conflict: ${uniqueVersions.joinToString(", ")}",
                    fontSize = 13.sp, color = Color(0xFFFFA500)
                )
            }
        }
    }
}
