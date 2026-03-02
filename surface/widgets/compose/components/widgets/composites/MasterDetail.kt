// ============================================================
// Clef Surface Compose Widget — MasterDetail
//
// Split-view layout with a scrollable master list on the left
// and a detail content pane on the right, separated by a
// vertical divider. Selecting an item displays its details.
// Renders as a Row with list pane and detail pane using
// Material 3 surface and divider components.
// Maps master-detail.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class MasterItem(
    val id: String,
    val label: String,
    val description: String? = null,
)

// --------------- Component ---------------

/**
 * Master-detail composable with a scrollable item list on the left
 * and a detail content area on the right separated by a divider.
 *
 * @param items Array of items for the master list.
 * @param selectedId ID of the currently selected item.
 * @param onSelect Callback when an item is selected from the list.
 * @param modifier Compose modifier for the root element.
 * @param detailContent Composable slot for the detail pane content.
 */
@Composable
fun MasterDetail(
    items: List<MasterItem>,
    selectedId: String? = null,
    onSelect: ((MasterItem) -> Unit)? = null,
    modifier: Modifier = Modifier,
    detailContent: @Composable () -> Unit = {},
) {
    val selectedItem = remember(items, selectedId) {
        items.find { it.id == selectedId }
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Row(modifier = Modifier.fillMaxWidth()) {
            // Master Pane
            Column(
                modifier = Modifier.width(240.dp).padding(16.dp),
            ) {
                Row {
                    Text(
                        text = "Items",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "(${items.size})",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))

                if (items.isEmpty()) {
                    Text(
                        text = "No items.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else {
                    LazyColumn {
                        itemsIndexed(items) { _, item ->
                            val isSelected = item.id == selectedId
                            Surface(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSelect?.invoke(item) },
                                color = if (isSelected)
                                    MaterialTheme.colorScheme.primaryContainer
                                else
                                    MaterialTheme.colorScheme.surface,
                                shape = MaterialTheme.shapes.small,
                            ) {
                                Row(modifier = Modifier.padding(8.dp)) {
                                    Text(
                                        text = if (isSelected) "\u25CF " else "  ",
                                        color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(
                                        text = item.label,
                                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                        color = if (isSelected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                                        style = MaterialTheme.typography.bodyMedium,
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Divider
            VerticalDivider(modifier = Modifier.fillMaxHeight())

            // Detail Pane
            Column(
                modifier = Modifier.weight(1f).padding(16.dp),
            ) {
                if (selectedItem != null) {
                    Text(
                        text = selectedItem.label,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    if (selectedItem.description != null) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = selectedItem.description,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    detailContent()
                } else {
                    Text(
                        text = "Select an item from the list to view details.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        }
    }
}
