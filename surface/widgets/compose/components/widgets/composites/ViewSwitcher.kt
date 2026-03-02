// ============================================================
// Clef Surface Compose Widget — ViewSwitcher
//
// Multi-view toggle bar presenting available view modes as a
// horizontal row of toggle buttons. Active view is shown with
// filled styling, inactive views with outline styling. Renders
// as a Row of toggle buttons controlling content display.
// Maps view-switcher.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ViewDef(
    val id: String,
    val label: String,
    val icon: String? = null,
)

// --------------- Component ---------------

/**
 * View switcher composable rendering a horizontal row of toggle
 * buttons for switching between different content display modes.
 * The active view is visually distinguished with filled styling.
 *
 * @param views Array of available views.
 * @param activeView ID of the currently active view.
 * @param onChange Callback when the active view changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun ViewSwitcher(
    views: List<ViewDef>,
    activeView: String,
    onChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        views.forEach { view ->
            val isActive = view.id == activeView
            val label = buildString {
                if (view.icon != null) {
                    append(view.icon)
                    append(" ")
                }
                append(view.label)
            }

            if (isActive) {
                Button(
                    onClick = { onChange?.invoke(view.id) },
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text(
                        text = label,
                        fontWeight = FontWeight.Bold,
                    )
                }
            } else {
                OutlinedButton(
                    onClick = { onChange?.invoke(view.id) },
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                ) {
                    Text(text = label)
                }
            }
        }
    }
}
