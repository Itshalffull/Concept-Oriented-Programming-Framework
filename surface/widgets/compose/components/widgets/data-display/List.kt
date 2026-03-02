// ============================================================
// Clef Surface Compose Widget — List
//
// Vertical list displaying a collection of items with optional
// selection, icons, and descriptions. Compose adaptation: uses
// LazyColumn with Material 3 ListItem composables, optional
// leading icons, trailing selection checkmarks, and supporting
// text for descriptions.
// See widget spec: repertoire/widgets/data-display/list.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight

// --------------- Types ---------------

data class ClefListItem(
    val id: String,
    val label: String,
    val description: String? = null,
    val icon: ImageVector? = null,
)

// --------------- Component ---------------

/**
 * Vertical item list with optional selection, icons, and descriptions.
 *
 * @param items Array of items to display.
 * @param selectable Whether items are selectable.
 * @param selectedId Currently selected item ID.
 * @param onSelect Callback when an item is selected.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ClefList(
    items: List<ClefListItem>,
    selectable: Boolean = false,
    selectedId: String? = null,
    onSelect: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) {
        Text(
            text = "No items",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier,
        )
        return
    }

    LazyColumn(modifier = modifier.fillMaxWidth()) {
        itemsIndexed(items, key = { _, item -> item.id }) { index, item ->
            val isSelected = item.id == selectedId

            ListItem(
                headlineContent = {
                    Text(
                        text = item.label,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    )
                },
                supportingContent = if (item.description != null) {
                    {
                        Text(
                            text = item.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    null
                },
                leadingContent = if (item.icon != null) {
                    {
                        Icon(
                            imageVector = item.icon,
                            contentDescription = null,
                        )
                    }
                } else {
                    null
                },
                trailingContent = if (selectable && isSelected) {
                    {
                        Icon(
                            imageVector = Icons.Filled.Check,
                            contentDescription = "Selected",
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                } else {
                    null
                },
                colors = if (isSelected) {
                    ListItemDefaults.colors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                    )
                } else {
                    ListItemDefaults.colors()
                },
                modifier = Modifier.then(
                    if (selectable) Modifier.clickable { onSelect(item.id) } else Modifier,
                ),
            )

            if (index < items.lastIndex) {
                HorizontalDivider()
            }
        }
    }
}
