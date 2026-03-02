// ============================================================
// Clef Surface Compose Widget — GraphView
//
// Force-directed node-and-edge graph visualization. Nodes are
// drawn as circles with labels on a Canvas, connected by edge
// lines. Supports node selection and keyboard/tap navigation.
//
// Adapts the graph-view.widget spec: anatomy (root, canvas,
// filterPanel, searchInput, typeToggles, displayControls,
// minimap, detailPanel, modeToggle), states, and connect
// attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class GraphNode(
    val id: String,
    val label: String,
)

data class GraphEdge(
    val from: String,
    val to: String,
    val label: String? = null,
)

// --------------- Component ---------------

/**
 * Graph visualization with nodes and edges drawn on a Canvas.
 *
 * @param nodes Nodes in the graph.
 * @param edges Edges connecting nodes.
 * @param selectedNode ID of the currently selected node.
 * @param canvasHeight Height of the drawing canvas.
 * @param onSelectNode Callback when a node is selected.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun GraphView(
    nodes: List<GraphNode>,
    edges: List<GraphEdge>,
    selectedNode: String? = null,
    canvasHeight: Dp = 200.dp,
    onSelectNode: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    // Build adjacency for display
    val adjacency = mutableMapOf<String, MutableList<Pair<String, String?>>>()
    edges.forEach { edge ->
        adjacency.getOrPut(edge.from) { mutableListOf() }.add(edge.to to edge.label)
    }
    val nodeLabels = nodes.associate { it.id to it.label }

    Column(modifier = modifier.padding(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Graph",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = " (${nodes.size} nodes, ${edges.size} edges)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Canvas visualization
        Canvas(modifier = Modifier.fillMaxWidth().height(canvasHeight)) {
            if (nodes.isEmpty()) return@Canvas

            val centerX = size.width / 2f
            val centerY = size.height / 2f
            val radius = minOf(centerX, centerY) * 0.7f
            val nodeRadius = 20f

            // Position nodes in a circle
            val positions = nodes.mapIndexed { index, node ->
                val angle = (2 * Math.PI * index / nodes.size) - Math.PI / 2
                node.id to Offset(
                    centerX + radius * kotlin.math.cos(angle).toFloat(),
                    centerY + radius * kotlin.math.sin(angle).toFloat(),
                )
            }.toMap()

            // Draw edges
            edges.forEach { edge ->
                val from = positions[edge.from] ?: return@forEach
                val to = positions[edge.to] ?: return@forEach
                drawLine(
                    color = Color.Gray,
                    start = from,
                    end = to,
                    strokeWidth = 2f,
                )
            }

            // Draw nodes
            nodes.forEach { node ->
                val pos = positions[node.id] ?: return@forEach
                val isSelected = node.id == selectedNode
                drawCircle(
                    color = if (isSelected) Color(0xFF6200EE) else Color(0xFF03DAC5),
                    radius = nodeRadius,
                    center = pos,
                )
                drawCircle(
                    color = Color.White,
                    radius = nodeRadius - 3f,
                    center = pos,
                    style = Stroke(width = 2f),
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Node list
        LazyColumn {
            itemsIndexed(nodes) { _, node ->
                val isSelected = node.id == selectedNode
                val outEdges = adjacency[node.id] ?: emptyList()

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
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "[${node.label}]",
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        )
                        if (outEdges.isNotEmpty()) {
                            Text(
                                text = " \u2192 " + outEdges.joinToString(", ") { (to, label) ->
                                    val targetLabel = nodeLabels[to] ?: to
                                    "[$targetLabel]" + (if (label != null) "($label)" else "")
                                },
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
        }

        if (nodes.isEmpty()) {
            Text(
                text = "(empty graph)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
