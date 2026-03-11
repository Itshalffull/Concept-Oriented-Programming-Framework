package com.clef.surface.widgets.concepts.governancestructure

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

enum class DelegationGraphState { Browsing, Searching, Selected, Delegating, Undelegating }

sealed class DelegationGraphEvent {
    data class Search(val query: String) : DelegationGraphEvent()
    object ClearSearch : DelegationGraphEvent()
    data class SelectNode(val id: String) : DelegationGraphEvent()
    object Deselect : DelegationGraphEvent()
    object Delegate : DelegationGraphEvent()
    object Undelegate : DelegationGraphEvent()
    object Confirm : DelegationGraphEvent()
    object Cancel : DelegationGraphEvent()
}

fun delegationGraphReduce(state: DelegationGraphState, event: DelegationGraphEvent): DelegationGraphState = when (state) {
    DelegationGraphState.Browsing -> when (event) {
        is DelegationGraphEvent.Search -> DelegationGraphState.Searching
        is DelegationGraphEvent.SelectNode -> DelegationGraphState.Selected
        else -> state
    }
    DelegationGraphState.Searching -> when (event) {
        is DelegationGraphEvent.ClearSearch -> DelegationGraphState.Browsing
        is DelegationGraphEvent.SelectNode -> DelegationGraphState.Selected
        else -> state
    }
    DelegationGraphState.Selected -> when (event) {
        is DelegationGraphEvent.Deselect -> DelegationGraphState.Browsing
        is DelegationGraphEvent.Delegate -> DelegationGraphState.Delegating
        is DelegationGraphEvent.Undelegate -> DelegationGraphState.Undelegating
        else -> state
    }
    DelegationGraphState.Delegating -> when (event) {
        is DelegationGraphEvent.Confirm -> DelegationGraphState.Browsing
        is DelegationGraphEvent.Cancel -> DelegationGraphState.Selected
        else -> state
    }
    DelegationGraphState.Undelegating -> when (event) {
        is DelegationGraphEvent.Confirm -> DelegationGraphState.Browsing
        is DelegationGraphEvent.Cancel -> DelegationGraphState.Selected
        else -> state
    }
}

// --- Types ---

data class DelegationNode(
    val id: String,
    val name: String,
    val weight: Float = 0f,
    val delegatedTo: String? = null
)

data class DelegationEdge(val from: String, val to: String, val weight: Float = 1f)

@Composable
fun DelegationGraph(
    nodes: List<DelegationNode>,
    edges: List<DelegationEdge>,
    modifier: Modifier = Modifier,
    onDelegate: (String) -> Unit = {},
    onUndelegate: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(DelegationGraphState.Browsing) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedId by remember { mutableStateOf<String?>(null) }
    var viewMode by remember { mutableStateOf("list") }

    val filteredNodes = remember(nodes, searchQuery) {
        if (searchQuery.isBlank()) nodes
        else nodes.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    val nodeMap = remember(nodes) { nodes.associateBy { it.id } }

    // Compute effective weights (transitive)
    val effectiveWeights = remember(nodes, edges) {
        val weights = mutableMapOf<String, Float>()
        nodes.forEach { weights[it.id] = it.weight }
        edges.forEach { edge ->
            weights[edge.to] = (weights[edge.to] ?: 0f) + (weights[edge.from] ?: 0f) * edge.weight
        }
        weights
    }

    val selectedNode = remember(selectedId, nodes) { selectedId?.let { id -> nodes.find { it.id == id } } }

    fun handleSelect(id: String) {
        val nextId = if (id == selectedId) null else id
        selectedId = nextId
        state = if (nextId != null) {
            delegationGraphReduce(state, DelegationGraphEvent.SelectNode(nextId))
        } else {
            delegationGraphReduce(state, DelegationGraphEvent.Deselect)
        }
    }

    Column(modifier = modifier.semantics { contentDescription = "Delegation graph" }) {
        // Search
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                state = if (it.isNotBlank()) {
                    delegationGraphReduce(state, DelegationGraphEvent.Search(it))
                } else {
                    delegationGraphReduce(state, DelegationGraphEvent.ClearSearch)
                }
            },
            label = { Text("Search delegates") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp)
        )

        // View toggle
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            FilterChip(selected = viewMode == "list", onClick = { viewMode = "list" }, label = { Text("List") })
            FilterChip(selected = viewMode == "graph", onClick = { viewMode = "graph" }, label = { Text("Graph") })
        }

        HorizontalDivider()

        // Delegate list
        LazyColumn(modifier = Modifier.weight(1f)) {
            items(filteredNodes, key = { it.id }) { node ->
                val isSelected = node.id == selectedId
                val effectiveWeight = effectiveWeights[node.id] ?: 0f
                val delegatee = node.delegatedTo?.let { nodeMap[it] }

                OutlinedCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 2.dp)
                        .clickable { handleSelect(node.id) }
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(node.name, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            Text("%.2f".format(effectiveWeight), fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
                        }
                        delegatee?.let {
                            Text("\u2192 ${it.name}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }

        // Detail/action panel
        selectedNode?.let { node ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Text(node.name, fontWeight = FontWeight.Bold)
                Text("Base weight: ${node.weight}", fontSize = 13.sp)
                Text("Effective weight: ${"%.2f".format(effectiveWeights[node.id] ?: 0f)}", fontSize = 13.sp)

                val upstream = edges.filter { it.to == node.id }.mapNotNull { nodeMap[it.from]?.name }
                val downstream = edges.filter { it.from == node.id }.mapNotNull { nodeMap[it.to]?.name }
                if (upstream.isNotEmpty()) Text("Delegated from: ${upstream.joinToString(", ")}", fontSize = 12.sp)
                if (downstream.isNotEmpty()) Text("Delegates to: ${downstream.joinToString(", ")}", fontSize = 12.sp)

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    when (state) {
                        DelegationGraphState.Delegating -> {
                            Button(onClick = {
                                onDelegate(node.id)
                                state = delegationGraphReduce(state, DelegationGraphEvent.Confirm)
                            }) { Text("Confirm Delegate") }
                            OutlinedButton(onClick = {
                                state = delegationGraphReduce(state, DelegationGraphEvent.Cancel)
                            }) { Text("Cancel") }
                        }
                        DelegationGraphState.Undelegating -> {
                            Button(onClick = {
                                onUndelegate(node.id)
                                state = delegationGraphReduce(state, DelegationGraphEvent.Confirm)
                            }) { Text("Confirm Undelegate") }
                            OutlinedButton(onClick = {
                                state = delegationGraphReduce(state, DelegationGraphEvent.Cancel)
                            }) { Text("Cancel") }
                        }
                        else -> {
                            Button(onClick = {
                                state = delegationGraphReduce(state, DelegationGraphEvent.Delegate)
                            }) { Text("Delegate") }
                            if (node.delegatedTo != null) {
                                OutlinedButton(onClick = {
                                    state = delegationGraphReduce(state, DelegationGraphEvent.Undelegate)
                                }) { Text("Undelegate") }
                            }
                        }
                    }
                }
            }
        }
    }
}
