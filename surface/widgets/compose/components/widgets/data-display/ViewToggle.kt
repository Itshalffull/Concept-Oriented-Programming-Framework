// ============================================================
// Clef Surface Compose Widget — ViewToggle
//
// Compact segmented control for switching between display modes
// such as grid, list, table, or calendar views. Compose
// adaptation: Material 3 SingleChoiceSegmentedButtonRow with
// SegmentedButton items, or a fallback Row of FilterChip/
// IconButton options for broader compatibility.
// See widget spec: repertoire/widgets/data-display/view-toggle.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ViewOption(
    val id: String,
    val label: String,
    val icon: ImageVector? = null,
)

// --------------- Component ---------------

/**
 * Segmented toggle for switching between display modes.
 *
 * @param views Available view options.
 * @param activeView Currently active view ID.
 * @param onChange Callback when the active view changes.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ViewToggle(
    views: List<ViewOption>,
    activeView: String,
    onChange: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (views.isEmpty()) {
        Text(
            text = "No views",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier,
        )
        return
    }

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        views.forEachIndexed { index, view ->
            val isActive = view.id == activeView

            FilterChip(
                selected = isActive,
                onClick = { onChange(view.id) },
                label = { Text(text = view.label) },
                leadingIcon = if (view.icon != null) {
                    {
                        Icon(
                            imageVector = view.icon,
                            contentDescription = null,
                        )
                    }
                } else {
                    null
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
                ),
            )

            if (index < views.lastIndex) {
                Spacer(modifier = Modifier.width(8.dp))
            }
        }
    }
}
