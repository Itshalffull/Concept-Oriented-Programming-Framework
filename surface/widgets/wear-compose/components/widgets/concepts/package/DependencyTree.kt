package com.clef.surface.widgets.concepts.pkg

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

enum class DependencyTreeState { Idle, NodeSelected }

sealed class DependencyTreeEvent {
    data class SelectNode(val name: String) : DependencyTreeEvent()
    object Deselect : DependencyTreeEvent()
}

fun dependencyTreeReduce(
    state: DependencyTreeState,
    event: DependencyTreeEvent
): DependencyTreeState = when (state) {
    DependencyTreeState.Idle -> when (event) {
        is DependencyTreeEvent.SelectNode -> DependencyTreeState.NodeSelected
        else -> state
    }
    DependencyTreeState.NodeSelected -> when (event) {
        is DependencyTreeEvent.Deselect -> DependencyTreeState.Idle
        is DependencyTreeEvent.SelectNode -> DependencyTreeState.NodeSelected
    }
}

// --- Public types ---

data class DependencyNode(
    val name: String,
    val version: String,
    val children: List<DependencyNode> = emptyList(),
    val hasVulnerability: Boolean = false,
    val isDuplicate: Boolean = false
)

private fun flattenDeps(
    nodes: List<DependencyNode>,
    expandedNames: Set<String>,
    depth: Int = 0
): List<Pair<Int, DependencyNode>> {
    val result = mutableListOf<Pair<Int, DependencyNode>>()
    for (node in nodes) {
        result.add(depth to node)
        if (node.children.isNotEmpty() && node.name in expandedNames) {
            result.addAll(flattenDeps(node.children, expandedNames, depth + 1))
        }
    }
    return result
}

@Composable
fun DependencyTree(
    dependencies: List<DependencyNode>,
    modifier: Modifier = Modifier,
    onSelectNode: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(DependencyTreeState.Idle) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    var expandedNames by remember { mutableStateOf(setOf<String>()) }
    val listState = rememberScalingLazyListState()

    val flatList = remember(dependencies, expandedNames) {
        flattenDeps(dependencies, expandedNames)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Dependency tree" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Deps (${dependencies.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(flatList) { (depth, node) ->
            val isSelected = selectedName == node.name
            val hasChildren = node.children.isNotEmpty()
            val isExpanded = node.name in expandedNames
            val expandIcon = if (hasChildren) (if (isExpanded) "\u25BC" else "\u25B6") else " "
            val vulnIcon = if (node.hasVulnerability) " \u26A0" else ""

            Chip(
                onClick = {
                    if (hasChildren) {
                        expandedNames = if (isExpanded) expandedNames - node.name else expandedNames + node.name
                    }
                    val next = if (isSelected) null else node.name
                    selectedName = next
                    state = dependencyTreeReduce(
                        state,
                        if (next != null) DependencyTreeEvent.SelectNode(next)
                        else DependencyTreeEvent.Deselect
                    )
                    if (next != null) onSelectNode(next)
                },
                label = {
                    Text(
                        text = "$expandIcon ${node.name}$vulnIcon",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = if (node.hasVulnerability) Color(0xFFEF4444) else MaterialTheme.colorScheme.onSurface
                    )
                },
                secondaryLabel = {
                    val dupLabel = if (node.isDuplicate) " (dup)" else ""
                    Text("${node.version}$dupLabel", style = MaterialTheme.typography.labelSmall)
                },
                modifier = Modifier.padding(start = (depth * 12).dp)
            )
        }
    }
}
