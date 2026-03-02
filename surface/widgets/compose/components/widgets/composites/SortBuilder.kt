// ============================================================
// Clef Surface Compose Widget — SortBuilder
//
// Multi-column sort priority list with ascending/descending
// direction toggles and reorder capability. Each row displays
// a field name and direction indicator. Supports adding,
// removing, toggling direction, and reordering sort criteria.
// Renders as a Column of sortable field rows with icon buttons.
// Maps sort-builder.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class SortRule(
    val field: String,
    val direction: SortDirection,
)

enum class SortDirection { ASCENDING, DESCENDING }

data class SortFieldDef(
    val label: String,
    val value: String,
)

// --------------- Component ---------------

/**
 * Sort builder composable rendering a prioritized list of sort
 * rules with direction toggles, reorder buttons, and add/remove
 * controls for building multi-column sort expressions.
 *
 * @param sorts Array of current sort rules in priority order.
 * @param fields Available fields for sorting.
 * @param onAdd Callback to add a new sort rule.
 * @param onRemove Callback to remove a sort rule by index.
 * @param onChange Callback when a sort rule changes.
 * @param onReorder Callback to reorder sort rules.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun SortBuilder(
    sorts: List<SortRule>,
    fields: List<SortFieldDef>,
    onAdd: (() -> Unit)? = null,
    onRemove: ((Int) -> Unit)? = null,
    onChange: ((Int, SortRule) -> Unit)? = null,
    onReorder: ((fromIndex: Int, toIndex: Int) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Sort Builder",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(${sorts.size} rules)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Sort Rows
            if (sorts.isEmpty()) {
                Text(
                    text = "No sort rules defined.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    itemsIndexed(sorts) { index, sort ->
                        SortRuleRow(
                            index = index,
                            sort = sort,
                            fields = fields,
                            isFirst = index == 0,
                            isLast = index == sorts.lastIndex,
                            onToggleDirection = {
                                val newDir = if (sort.direction == SortDirection.ASCENDING)
                                    SortDirection.DESCENDING else SortDirection.ASCENDING
                                onChange?.invoke(index, sort.copy(direction = newDir))
                            },
                            onMoveUp = { onReorder?.invoke(index, index - 1) },
                            onMoveDown = { onReorder?.invoke(index, index + 1) },
                            onRemove = { onRemove?.invoke(index) },
                        )
                    }
                }
            }

            // Add Sort Button
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(onClick = { onAdd?.invoke() }) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Sort")
            }
        }
    }
}

@Composable
private fun SortRuleRow(
    index: Int,
    sort: SortRule,
    fields: List<SortFieldDef>,
    isFirst: Boolean,
    isLast: Boolean,
    onToggleDirection: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onRemove: () -> Unit,
) {
    val fieldLabel = fields.find { it.value == sort.field }?.label ?: sort.field
    val dirLabel = if (sort.direction == SortDirection.ASCENDING) "ASC" else "DESC"
    val dirColor = if (sort.direction == SortDirection.ASCENDING) Color(0xFF4CAF50) else Color(0xFFFF9800)
    val dirIcon = if (sort.direction == SortDirection.ASCENDING) "\u25B2" else "\u25BC"

    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Priority number
        Text(
            text = "${index + 1}. ",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        // Field name
        Text(
            text = fieldLabel,
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyMedium,
        )
        // Direction toggle
        TextButton(
            onClick = onToggleDirection,
            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
        ) {
            Text("$dirIcon $dirLabel", color = dirColor, fontWeight = FontWeight.Bold)
        }
        // Reorder buttons
        IconButton(
            onClick = onMoveUp,
            enabled = !isFirst,
            modifier = Modifier.size(24.dp),
        ) {
            Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Move up", modifier = Modifier.size(16.dp))
        }
        IconButton(
            onClick = onMoveDown,
            enabled = !isLast,
            modifier = Modifier.size(24.dp),
        ) {
            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Move down", modifier = Modifier.size(16.dp))
        }
        // Remove button
        IconButton(
            onClick = onRemove,
            modifier = Modifier.size(24.dp),
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = "Remove sort",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
        }
    }
}
