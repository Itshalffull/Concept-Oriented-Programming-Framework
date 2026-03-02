// ============================================================
// Clef Surface Compose Widget — CanvasNode
//
// Individual element on a canvas surface rendered as a draggable
// Card. Supports selection, label display, position info, and
// drag interaction for repositioning on the canvas.
//
// Adapts the canvas-node.widget spec: anatomy (root, content,
// handles, handle, label), states (idle, hovered, selected,
// editing, dragging, resizing, deleted), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class CanvasPosition(
    val x: Float,
    val y: Float,
)

// --------------- Component ---------------

/**
 * Draggable card representing a node on a canvas surface.
 *
 * @param id Unique identifier for the node.
 * @param label Display label for the node.
 * @param position Position of the node on the canvas.
 * @param selected Whether the node is currently selected.
 * @param type Visual type of the node.
 * @param onSelect Callback when the node is tapped.
 * @param onDrag Callback when the node is dragged, receiving delta offset.
 * @param modifier Modifier for the root Card.
 */
@Composable
fun CanvasNode(
    id: String,
    label: String,
    position: CanvasPosition = CanvasPosition(0f, 0f),
    selected: Boolean = false,
    type: String? = null,
    onSelect: (String) -> Unit = {},
    onDrag: (String, Offset) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    val borderColor = if (selected)
        MaterialTheme.colorScheme.primary
    else
        MaterialTheme.colorScheme.outline

    Card(
        modifier = modifier
            .clickable { onSelect(id) }
            .border(
                width = if (selected) 2.dp else 1.dp,
                color = borderColor,
                shape = MaterialTheme.shapes.medium,
            )
            .pointerInput(id) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    onDrag(id, Offset(dragAmount.x, dragAmount.y))
                }
            },
        colors = CardDefaults.cardColors(
            containerColor = if (selected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = label + (if (type != null) " [$type]" else ""),
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                color = if (selected)
                    MaterialTheme.colorScheme.onPrimaryContainer
                else
                    MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = "(${position.x.toInt()}, ${position.y.toInt()})" +
                    if (selected) " [selected]" else "",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
