// ============================================================
// Clef Surface Compose Widget — QueueDashboard
//
// Monitoring dashboard for background job queues displaying
// summary stats (pending, active, completed, failed), per-queue
// progress bars, and action buttons for retry and purge.
// Renders as a Column with stats summary and a LazyColumn of
// queue items with LinearProgressIndicator and action buttons.
// Maps queue-dashboard.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Queue(
    val name: String,
    val pending: Int,
    val active: Int,
    val completed: Int,
    val failed: Int,
)

// --------------- Component ---------------

/**
 * Queue dashboard composable displaying a summary of job queues
 * with progress indicators and retry/purge action buttons.
 *
 * @param queues Array of queues to display.
 * @param onSelect Callback when a queue is selected.
 * @param onRetry Callback to retry failed jobs in a queue.
 * @param onPurge Callback to purge a queue.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun QueueDashboard(
    queues: List<Queue>,
    onSelect: ((Queue) -> Unit)? = null,
    onRetry: ((String) -> Unit)? = null,
    onPurge: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Queue Dashboard",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(${queues.size} queues)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Table Header
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Queue", modifier = Modifier.weight(2f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Pend", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Act", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Done", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Fail", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Spacer(modifier = Modifier.width(80.dp))
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Queue Rows
            if (queues.isEmpty()) {
                Text(
                    text = "No queues.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(queues) { _, queue ->
                        QueueRow(
                            queue = queue,
                            onSelect = { onSelect?.invoke(queue) },
                            onRetry = { onRetry?.invoke(queue.name) },
                            onPurge = { onPurge?.invoke(queue.name) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QueueRow(
    queue: Queue,
    onSelect: () -> Unit,
    onRetry: () -> Unit,
    onPurge: () -> Unit,
) {
    val total = queue.pending + queue.active + queue.completed + queue.failed
    val progress = if (total > 0) queue.completed.toFloat() / total else 0f

    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = queue.name,
                modifier = Modifier.weight(2f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "${queue.pending}",
                modifier = Modifier.weight(1f),
                color = if (queue.pending > 0) Color(0xFFFF9800) else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "${queue.active}",
                modifier = Modifier.weight(1f),
                color = if (queue.active > 0) Color(0xFF2196F3) else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "${queue.completed}",
                modifier = Modifier.weight(1f),
                color = Color(0xFF4CAF50),
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = "${queue.failed}",
                modifier = Modifier.weight(1f),
                color = if (queue.failed > 0) Color(0xFFF44336) else MaterialTheme.colorScheme.onSurface,
                style = MaterialTheme.typography.bodyMedium,
            )
            TextButton(
                onClick = onRetry,
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
            ) {
                Text("Retry", style = MaterialTheme.typography.labelSmall, color = Color(0xFFFF9800))
            }
            TextButton(
                onClick = onPurge,
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
            ) {
                Text("Purge", style = MaterialTheme.typography.labelSmall, color = Color(0xFFF44336))
            }
        }
        LinearProgressIndicator(
            progress = { progress },
            modifier = Modifier.fillMaxWidth().height(4.dp),
            color = Color(0xFF4CAF50),
        )
    }
}
