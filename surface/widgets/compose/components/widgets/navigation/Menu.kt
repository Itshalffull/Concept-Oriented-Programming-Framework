// ============================================================
// Clef Surface Compose Widget — Menu
//
// Dropdown command menu for Jetpack Compose.
// Uses Material 3 DropdownMenu and DropdownMenuItem for
// rendering a list of actions with support for shortcuts,
// disabled items, and danger styling. Maps menu.widget anatomy
// (root, trigger, content, item, separator, etc.) to
// DropdownMenu composables.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Box
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color

// --------------- Types ---------------

data class MenuItem(
    val id: String,
    val label: String,
    val shortcut: String? = null,
    val disabled: Boolean = false,
    val danger: Boolean = false,
)

// --------------- Component ---------------

/**
 * Dropdown command menu.
 *
 * @param items Menu action items.
 * @param open Whether the menu is visible.
 * @param onSelect Callback when an item is selected.
 * @param onClose Callback when the menu is dismissed.
 * @param modifier Modifier for the root container.
 * @param trigger Optional trigger composable that opens the menu.
 */
@Composable
fun Menu(
    items: List<MenuItem>,
    open: Boolean = false,
    onSelect: ((MenuItem) -> Unit)? = null,
    onClose: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    trigger: (@Composable () -> Unit)? = null,
) {
    Box(modifier = modifier) {
        trigger?.invoke()

        DropdownMenu(
            expanded = open,
            onDismissRequest = { onClose?.invoke() },
        ) {
            items.forEach { item ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = item.label,
                            color = when {
                                item.disabled -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                                item.danger -> MaterialTheme.colorScheme.error
                                else -> Color.Unspecified
                            },
                        )
                    },
                    onClick = {
                        if (!item.disabled) {
                            onSelect?.invoke(item)
                        }
                    },
                    enabled = !item.disabled,
                    trailingIcon = if (item.shortcut != null) {
                        {
                            Text(
                                text = item.shortcut,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else null,
                )
            }
        }
    }
}
