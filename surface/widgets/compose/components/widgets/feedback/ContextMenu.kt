// ============================================================
// Clef Surface Compose Widget — ContextMenu
//
// Contextual action menu anchored to a trigger element.
// Supports item labels, optional keyboard shortcut hints,
// disabled items, and destructive (danger) styling. Dismisses
// on outside click or item selection.
//
// Compose adaptation: DropdownMenu with DropdownMenuItems.
// Disabled and danger states expressed via color and enabled
// parameters. Shortcut text right-aligned via trailing content.
// See widget spec: repertoire/widgets/feedback/context-menu.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

/**
 * Represents a single item in a [ClefContextMenu].
 *
 * @property label Display label for the menu item.
 * @property shortcut Optional keyboard shortcut hint displayed right-aligned.
 * @property disabled Whether this item is disabled (visible but not activatable).
 * @property danger Whether this item represents a destructive/dangerous action.
 */
data class ContextMenuItem(
    val label: String,
    val shortcut: String? = null,
    val disabled: Boolean = false,
    val danger: Boolean = false,
)

// --------------- Component ---------------

/**
 * Contextual action menu anchored to a trigger element.
 *
 * @param expanded Whether the context menu is visible.
 * @param items List of menu items to display.
 * @param onSelect Callback fired when an item is selected, with the item index.
 * @param onDismiss Callback fired when the menu is dismissed.
 * @param offset Optional offset applied to the popup position.
 * @param modifier Modifier applied to the trigger Box.
 * @param trigger Composable content that serves as the menu anchor.
 */
@Composable
fun ClefContextMenu(
    expanded: Boolean = false,
    items: List<ContextMenuItem>,
    onSelect: ((Int) -> Unit)? = null,
    onDismiss: (() -> Unit)? = null,
    offset: DpOffset = DpOffset(0.dp, 0.dp),
    modifier: Modifier = Modifier,
    trigger: @Composable () -> Unit = {},
) {
    Box(modifier = modifier) {
        // Trigger content (always rendered)
        trigger()

        // Dropdown menu
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { onDismiss?.invoke() },
            offset = offset,
        ) {
            items.forEachIndexed { index, item ->
                DropdownMenuItem(
                    text = {
                        Text(
                            text = item.label,
                            color = when {
                                item.danger -> MaterialTheme.colorScheme.error
                                else -> Color.Unspecified
                            },
                        )
                    },
                    onClick = {
                        if (!item.disabled) {
                            onSelect?.invoke(index)
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
                    } else {
                        null
                    },
                )
            }
        }
    }
}
