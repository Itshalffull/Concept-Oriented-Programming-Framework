// ============================================================
// Clef Surface Compose Widget — WorkflowNode
//
// Single node within a workflow graph rendered as a Card
// with status icon, label, and input/output port indicators.
// Status is indicated by icon and color.
//
// Adapts the workflow-node.widget spec: anatomy (root, header,
// icon, title, statusBadge, inputPorts, inputPort, outputPorts,
// outputPort, body), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private val STATUS_ICONS = mapOf(
    "idle" to "\u25CB",
    "running" to "\u25CE",
    "completed" to "\u25CF",
    "error" to "\u2716",
)

private val STATUS_COLORS = mapOf(
    "idle" to Color.Gray,
    "running" to Color(0xFFFFC107),
    "completed" to Color(0xFF4CAF50),
    "error" to Color(0xFFF44336),
)

// --------------- Component ---------------

/**
 * Workflow node Card with ports (input/output indicators).
 *
 * @param id Unique identifier for the node.
 * @param label Display label for the node.
 * @param type Type of the workflow node.
 * @param status Execution status: "idle", "running", "completed", "error".
 * @param inputs Input port names.
 * @param outputs Output port names.
 * @param onSelect Callback when the node is tapped.
 * @param modifier Modifier for the root Card.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun WorkflowNode(
    id: String,
    label: String,
    type: String,
    status: String = "idle",
    inputs: List<String> = emptyList(),
    outputs: List<String> = emptyList(),
    onSelect: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val statusIcon = STATUS_ICONS[status] ?: STATUS_ICONS["idle"]!!
    val statusColor = STATUS_COLORS[status] ?: STATUS_COLORS["idle"]!!

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { onSelect(id) }
            .border(
                width = 1.dp,
                color = statusColor,
                shape = MaterialTheme.shapes.medium,
            ),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "[$statusIcon]",
                    color = statusColor,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "($type)",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Input ports
            if (inputs.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(start = 8.dp, top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "in:",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        inputs.forEach { port ->
                            Text(
                                text = "\u25C0$port",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // Output ports
            if (outputs.isNotEmpty()) {
                Row(
                    modifier = Modifier.padding(start = 8.dp, top = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "out:",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        outputs.forEach { port ->
                            Text(
                                text = "$port\u25B6",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // Status line
            Text(
                text = "Status: $status",
                style = MaterialTheme.typography.labelSmall,
                color = statusColor,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}
