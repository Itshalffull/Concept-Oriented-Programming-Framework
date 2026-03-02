// ============================================================
// Clef Surface Compose Widget — FilterBuilder
//
// Visual query builder for constructing compound filter
// expressions. Displays a Column of filter Row items, each
// with field selector, operator selector, and value input.
// Supports adding and removing filter rows via icon buttons.
// Maps filter-builder.widget anatomy.
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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class FilterRow(
    val field: String,
    val operator: String,
    val value: String,
)

data class FieldDef(
    val label: String,
    val value: String,
)

data class OperatorDef(
    val label: String,
    val value: String,
)

// --------------- Component ---------------

/**
 * Filter builder composable rendering a Column of filter rows,
 * each with field, operator, and value selectors, plus add/remove
 * controls for managing compound filter expressions.
 *
 * @param filters Array of active filter rows.
 * @param fields Available fields for filtering.
 * @param operators Available comparison operators.
 * @param onAdd Callback to add a new filter row.
 * @param onRemove Callback to remove a filter row by index.
 * @param onChange Callback when a filter row changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun FilterBuilder(
    filters: List<FilterRow>,
    fields: List<FieldDef>,
    operators: List<OperatorDef>,
    onAdd: (() -> Unit)? = null,
    onRemove: ((Int) -> Unit)? = null,
    onChange: ((Int, FilterRow) -> Unit)? = null,
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
                    text = "Filter Builder",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(${filters.size} active)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Filter Rows
            if (filters.isEmpty()) {
                Text(
                    text = "No filters defined.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(filters) { index, filter ->
                        FilterRowItem(
                            filter = filter,
                            fields = fields,
                            operators = operators,
                            onRemove = { onRemove?.invoke(index) },
                            onChange = { updated -> onChange?.invoke(index, updated) },
                        )
                    }
                }
            }

            // Add Filter Button
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(onClick = { onAdd?.invoke() }) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Filter")
            }
        }
    }
}

@Composable
private fun FilterRowItem(
    filter: FilterRow,
    fields: List<FieldDef>,
    operators: List<OperatorDef>,
    onRemove: () -> Unit,
    onChange: (FilterRow) -> Unit,
) {
    val fieldLabel = fields.find { it.value == filter.field }?.label ?: filter.field
    val opLabel = operators.find { it.value == filter.operator }?.label ?: filter.operator

    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Field chip
        AssistChip(
            onClick = { /* toggle field selector */ },
            label = { Text(fieldLabel) },
            modifier = Modifier.padding(end = 4.dp),
        )
        // Operator chip
        AssistChip(
            onClick = { /* toggle operator selector */ },
            label = { Text(opLabel) },
            modifier = Modifier.padding(end = 4.dp),
        )
        // Value chip
        AssistChip(
            onClick = { /* toggle value editor */ },
            label = { Text(filter.value.ifEmpty { "..." }) },
            modifier = Modifier.padding(end = 4.dp),
        )
        Spacer(modifier = Modifier.weight(1f))
        // Remove button
        IconButton(
            onClick = onRemove,
            modifier = Modifier.size(24.dp),
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = "Remove filter",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
        }
    }
}
