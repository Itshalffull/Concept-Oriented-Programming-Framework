// ============================================================
// Clef Surface Compose Widget — Toolbar
//
// Horizontal or vertical row of action controls for Compose.
// Uses Material 3 TopAppBar for horizontal layout or a Column
// of IconButtons for vertical layout. Supports active, disabled,
// and toggle states. Maps toolbar.widget anatomy (root, group,
// separator) with slotted items to Row of IconButtons.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ToolbarItem(
    val id: String,
    val label: String,
    val icon: String? = null,
    val disabled: Boolean = false,
    val active: Boolean = false,
)

// --------------- Component ---------------

/**
 * Horizontal or vertical row of action controls.
 *
 * @param items Toolbar action items.
 * @param orientation Layout orientation: "horizontal" or "vertical".
 * @param onSelect Callback when an item is selected.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Toolbar(
    items: List<ToolbarItem>,
    orientation: String = "horizontal",
    onSelect: ((ToolbarItem) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val isHorizontal = orientation == "horizontal"

    val content: @Composable () -> Unit = {
        items.forEach { item ->
            val display = item.icon ?: item.label

            if (item.active) {
                FilledIconButton(
                    onClick = { onSelect?.invoke(item) },
                    enabled = !item.disabled,
                ) {
                    Text(
                        text = display,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            } else {
                IconButton(
                    onClick = { onSelect?.invoke(item) },
                    enabled = !item.disabled,
                ) {
                    Text(
                        text = display,
                        style = MaterialTheme.typography.labelMedium,
                        color = if (item.disabled) {
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        },
                    )
                }
            }
        }
    }

    if (isHorizontal) {
        Row(
            modifier = modifier,
            horizontalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            content()
        }
    } else {
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            content()
        }
    }
}
