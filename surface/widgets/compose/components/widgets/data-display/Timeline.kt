// ============================================================
// Clef Surface Compose Widget — Timeline
//
// Vertical timeline visualisation displaying items as nodes
// along a time axis. Each item has a title, description,
// timestamp, and optional status. Compose adaptation: Column
// with a vertical line drawn via Canvas alongside status-colored
// circle markers and content cards.
// See widget spec: repertoire/widgets/data-display/timeline.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

/** Status of a timeline event node. */
enum class TimelineStatus {
    Completed,
    Active,
    Pending,
    Error,
}

data class TimelineItem(
    val id: String,
    val title: String,
    val description: String? = null,
    val timestamp: String,
    val status: TimelineStatus = TimelineStatus.Pending,
)

// --------------- Helpers ---------------

private fun TimelineStatus.color(): Color = when (this) {
    TimelineStatus.Completed -> Color(0xFF4CAF50)
    TimelineStatus.Active -> Color(0xFF2196F3)
    TimelineStatus.Pending -> Color(0xFF9E9E9E)
    TimelineStatus.Error -> Color(0xFFF44336)
}

// --------------- Component ---------------

/**
 * Vertical timeline displaying events with status-colored node markers.
 *
 * @param items Timeline items to display in order.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Timeline(
    items: List<TimelineItem>,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) {
        Text(
            text = "No timeline items",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier,
        )
        return
    }

    Column(modifier = modifier.fillMaxWidth()) {
        items.forEachIndexed { index, item ->
            val isLast = index == items.lastIndex
            val nodeColor = item.status.color()
            val lineColor = MaterialTheme.colorScheme.outlineVariant

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(IntrinsicSize.Min),
            ) {
                // Timestamp column
                Box(
                    modifier = Modifier.width(72.dp),
                    contentAlignment = Alignment.TopEnd,
                ) {
                    Text(
                        text = item.timestamp,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(end = 8.dp, top = 2.dp),
                    )
                }

                // Node marker and connector line
                Box(
                    modifier = Modifier.width(24.dp).fillMaxHeight(),
                    contentAlignment = Alignment.TopCenter,
                ) {
                    // Vertical connector line (drawn behind the circle)
                    if (!isLast) {
                        val capturedLineColor = lineColor
                        Canvas(
                            modifier = Modifier
                                .fillMaxHeight()
                                .width(2.dp),
                        ) {
                            drawLine(
                                color = capturedLineColor,
                                start = Offset(size.width / 2f, 12f),
                                end = Offset(size.width / 2f, size.height),
                                strokeWidth = 2f,
                            )
                        }
                    }

                    // Status circle
                    Canvas(modifier = Modifier.size(12.dp)) {
                        if (item.status == TimelineStatus.Pending) {
                            // Hollow circle for pending
                            drawCircle(
                                color = nodeColor,
                                radius = size.minDimension / 2f,
                                style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f),
                            )
                        } else {
                            drawCircle(
                                color = nodeColor,
                                radius = size.minDimension / 2f,
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Content column
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .padding(bottom = if (isLast) 0.dp else 24.dp),
                ) {
                    Text(
                        text = item.title,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (item.status == TimelineStatus.Active) FontWeight.Bold else FontWeight.Normal,
                        color = if (item.status == TimelineStatus.Active) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                    )
                    if (item.description != null) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
