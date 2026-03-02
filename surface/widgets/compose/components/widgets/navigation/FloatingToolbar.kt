// ============================================================
// Clef Surface Compose Widget — FloatingToolbar
//
// Contextual floating toolbar for Jetpack Compose.
// Renders a horizontal row of action items inside a Surface
// with FAB-like elevation and rounded shape. Items are
// separated by dividers. Maps floating-toolbar.widget anatomy
// (root, content) with slotted items to Surface with Row.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class FloatingToolbarItem(
    val id: String,
    val label: String,
    val icon: String? = null,
    val disabled: Boolean = false,
)

// --------------- Component ---------------

/**
 * Contextual floating toolbar with FAB-like positioning.
 *
 * @param items Toolbar action items.
 * @param visible Whether the toolbar is visible.
 * @param onSelect Callback when an item is selected.
 * @param modifier Modifier for the root surface.
 */
@Composable
fun FloatingToolbar(
    items: List<FloatingToolbarItem>,
    visible: Boolean = true,
    onSelect: ((FloatingToolbarItem) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (!visible) return

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        shadowElevation = 6.dp,
        tonalElevation = 3.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            items.forEachIndexed { index, item ->
                if (index > 0) {
                    VerticalDivider(
                        modifier = Modifier
                            .height(24.dp)
                            .padding(horizontal = 2.dp),
                    )
                }

                IconButton(
                    onClick = { onSelect?.invoke(item) },
                    enabled = !item.disabled,
                ) {
                    Text(
                        text = item.icon ?: item.label,
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
}
