// ============================================================
// Clef Surface Compose Widget — Outliner
//
// Infinitely nested bullet-list outliner rendered as a
// LazyColumn with indented tree items. Supports
// collapse/expand toggles, selection, and indent/outdent
// actions.
//
// Adapts the outliner.widget spec: anatomy (root, breadcrumb,
// item, bullet, collapseToggle, content, children, dragHandle),
// states (expanded/collapsed, editing, zoom, drag), and connect
// attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class OutlinerItem(
    val id: String,
    val text: String,
    val level: Int,
    val collapsed: Boolean = false,
)

// --------------- Helpers ---------------

private fun getVisibleItems(items: List<OutlinerItem>): List<OutlinerItem> {
    val visible = mutableListOf<OutlinerItem>()
    var skipLevel = -1

    for (item in items) {
        if (skipLevel >= 0 && item.level > skipLevel) {
            continue
        }
        skipLevel = -1
        visible.add(item)
        if (item.collapsed) {
            skipLevel = item.level
        }
    }

    return visible
}

private fun hasChildren(items: List<OutlinerItem>, index: Int): Boolean {
    if (index >= items.lastIndex) return false
    return items[index + 1].level > items[index].level
}

// --------------- Component ---------------

/**
 * Nested bullet-list outliner with collapsible tree items.
 *
 * @param items Flat list of outline items with nesting levels.
 * @param selectedId ID of the currently selected item.
 * @param onSelect Callback when an item is tapped.
 * @param onToggle Callback to toggle collapse/expand.
 * @param onIndent Callback to indent an item.
 * @param onOutdent Callback to outdent an item.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Outliner(
    items: List<OutlinerItem>,
    selectedId: String? = null,
    onSelect: (String) -> Unit = {},
    onToggle: (String) -> Unit = {},
    onIndent: (String) -> Unit = {},
    onOutdent: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val visibleItems = remember(items) { getVisibleItems(items) }

    if (items.isEmpty()) {
        Text(
            text = "New item...",
            modifier = modifier.padding(16.dp),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }

    LazyColumn(modifier = modifier.padding(8.dp)) {
        itemsIndexed(visibleItems, key = { _, item -> item.id }) { _, item ->
            val isSelected = item.id == selectedId
            val originalIndex = items.indexOf(item)
            val itemHasChildren = if (originalIndex >= 0) hasChildren(items, originalIndex) else false
            val indent = item.level * 24

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSelect(item.id) }
                    .padding(start = indent.dp, top = 2.dp, bottom = 2.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                // Collapse/expand or bullet
                if (itemHasChildren) {
                    IconButton(
                        onClick = { onToggle(item.id) },
                        modifier = Modifier.padding(0.dp),
                    ) {
                        Icon(
                            imageVector = if (item.collapsed)
                                Icons.Default.ArrowRight
                            else
                                Icons.Default.ArrowDropDown,
                            contentDescription = if (item.collapsed) "Expand" else "Collapse",
                            tint = if (isSelected)
                                MaterialTheme.colorScheme.primary
                            else
                                MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.width(40.dp))
                    Text(
                        text = "\u2022",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }

                Text(
                    text = item.text,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                    color = if (isSelected)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}
