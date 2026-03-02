// ============================================================
// Clef Surface Compose Widget — WorkflowEditor
//
// Node-graph workflow canvas rendered as a Column with a
// LazyColumn of nodes and their connections. Supports node
// selection, adding/removing nodes, and displays connections
// between nodes as indented sub-items.
//
// Adapts the workflow-editor.widget spec: anatomy (root, canvas,
// nodePalette, configPanel, minimap, toolbar, executeButton),
// states (idle, nodeSelected, configuring, placing, draggingNew,
// executing, executionResult), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class WorkflowEditorNode(
    val id: String,
    val type: String,
    val label: String,
)

data class WorkflowConnection(
    val from: String,
    val to: String,
)

// --------------- Component ---------------

/**
 * Node-graph workflow editor with a LazyColumn of nodes and connections.
 *
 * @param nodes Nodes in the workflow graph.
 * @param connections Connections between nodes.
 * @param selectedNode ID of the currently selected node.
 * @param onSelectNode Callback when a node is selected.
 * @param onAddNode Callback to add a new node.
 * @param onRemoveNode Callback to remove a node by id.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun WorkflowEditor(
    nodes: List<WorkflowEditorNode>,
    connections: List<WorkflowConnection>,
    selectedNode: String? = null,
    onSelectNode: (String) -> Unit = {},
    onAddNode: () -> Unit = {},
    onRemoveNode: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // Build adjacency
    val adjacency = mutableMapOf<String, MutableList<String>>()
    connections.forEach { conn ->
        adjacency.getOrPut(conn.from) { mutableListOf() }.add(conn.to)
    }
    val nodeLabels = nodes.associate { it.id to it.label }

    Column(modifier = modifier.padding(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Workflow",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = " (${nodes.size} nodes, ${connections.size} connections)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn {
            itemsIndexed(nodes, key = { _, node -> node.id }) { _, node ->
                val isSelected = node.id == selectedNode
                val targets = adjacency[node.id] ?: emptyList()

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp)
                        .clickable { onSelectNode(node.id) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Column(modifier = Modifier.padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "[${node.type}]",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = node.label,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            )
                        }
                        // Connection targets
                        targets.forEach { targetId ->
                            val targetLabel = nodeLabels[targetId] ?: targetId
                            Text(
                                text = "  \u2514\u2500\u2500\u2192 $targetLabel",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(start = 16.dp, top = 2.dp),
                            )
                        }
                    }
                }
            }
        }

        if (nodes.isEmpty()) {
            Text(
                text = "(empty workflow)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(16.dp),
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onAddNode,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = "+ Add Node")
        }
    }
}
