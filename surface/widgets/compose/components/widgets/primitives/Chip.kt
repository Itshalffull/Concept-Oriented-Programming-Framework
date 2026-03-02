// ============================================================
// Clef Surface Compose Widget — Chip
//
// Compact interactive tag element rendered with Material 3 chip
// composables. Supports filled and outline variants, selection
// toggle, and an optional dismiss (remove) action.
//
// Adapts the chip.widget spec: anatomy (root, label,
// deleteButton, icon), states (idle, selected, hovered, focused,
// removed, deletable, disabled), and connect attributes
// (data-part, data-state, data-disabled) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// --------------- Component ---------------

/**
 * Chip composable that renders a compact tag with optional selection
 * and dismiss behaviour using Material 3 styling.
 *
 * @param label Text content of the chip.
 * @param variant Visual variant: "filled" or "outline".
 * @param selected Whether the chip is selected.
 * @param disabled Whether the chip is disabled.
 * @param removable Whether the chip can be removed (shows trailing close icon).
 * @param onSelect Callback when the chip is selected/deselected.
 * @param onRemove Callback when the remove action is triggered.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Chip(
    label: String = "",
    variant: String = "filled",
    selected: Boolean = false,
    disabled: Boolean = false,
    removable: Boolean = false,
    onSelect: (() -> Unit)? = null,
    onRemove: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val trailingIcon: @Composable (() -> Unit)? = if (removable) {
        {
            IconButton(
                onClick = { if (!disabled) onRemove?.invoke() },
                enabled = !disabled,
            ) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Remove",
                )
            }
        }
    } else {
        null
    }

    if (variant == "outline") {
        FilterChip(
            selected = selected,
            onClick = { if (!disabled) onSelect?.invoke() },
            label = { Text(text = label) },
            enabled = !disabled,
            trailingIcon = trailingIcon,
            modifier = modifier,
        )
    } else {
        FilterChip(
            selected = selected,
            onClick = { if (!disabled) onSelect?.invoke() },
            label = { Text(text = label) },
            enabled = !disabled,
            trailingIcon = trailingIcon,
            modifier = modifier,
        )
    }
}
