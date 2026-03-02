// ============================================================
// Clef Surface Compose Widget — DragHandle
//
// Reorder handle rendered as a grip icon using Material
// Icons.Default.DragHandle. Purely visual indicator for
// drag-and-drop reordering capability; actual drag logic
// is managed by parent containers.
//
// Adapts the drag-handle.widget spec: anatomy (root, icon),
// states (idle, hovered, focused, grabbed, dragging), and
// connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Drag reorder handle icon.
 *
 * @param disabled Whether the handle is visually disabled.
 * @param contentDescription Accessibility description.
 * @param modifier Modifier for the Icon.
 */
@Composable
fun DragHandle(
    disabled: Boolean = false,
    contentDescription: String = "Drag to reorder",
    modifier: Modifier = Modifier,
) {
    Icon(
        imageVector = Icons.Default.DragHandle,
        contentDescription = contentDescription,
        modifier = modifier.padding(4.dp),
        tint = if (disabled)
            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
        else
            MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
