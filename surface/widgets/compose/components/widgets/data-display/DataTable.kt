// ============================================================
// Clef Surface Compose Widget — DataTable
//
// Sortable data table with configurable columns, row selection,
// and header sort indicators. Compose adaptation: LazyColumn
// with a sticky header Row for column labels, data Rows for
// each record, HorizontalDivider between rows, and optional
// Checkbox selection.
// See widget spec: repertoire/widgets/data-display/data-table.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDownward
import androidx.compose.material.icons.filled.ArrowUpward
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class DataTableColumn(
    val key: String,
    val label: String,
    val width: Dp = 120.dp,
    val sortable: Boolean = false,
)

enum class SortDirection {
    Ascending,
    Descending,
    None,
}

// --------------- Component ---------------

/**
 * Sortable data table with configurable columns and optional row selection.
 *
 * @param columns Column definitions.
 * @param data Row data, each map keyed by column key.
 * @param sortColumn Currently sorted column key.
 * @param sortDirection Current sort direction.
 * @param selectable Whether rows are selectable via checkbox.
 * @param loading Whether data is loading.
 * @param emptyMessage Message shown when data is empty.
 * @param onSort Callback when a column header is tapped for sorting.
 * @param onSelectRow Callback when a row selection changes.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun DataTable(
    columns: List<DataTableColumn>,
    data: List<Map<String, Any?>>,
    sortColumn: String? = null,
    sortDirection: SortDirection = SortDirection.None,
    selectable: Boolean = false,
    loading: Boolean = false,
    emptyMessage: String = "No data available",
    onSort: (column: String, direction: SortDirection) -> Unit = { _, _ -> },
    onSelectRow: (rowIndex: Int, selected: Boolean) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    val selectedRows = remember { mutableStateListOf<Int>() }
    val scrollState = rememberScrollState()

    if (loading) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "Loading...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    if (data.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = emptyMessage,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    LazyColumn(modifier = modifier.fillMaxWidth()) {
        // Header row
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(scrollState)
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (selectable) {
                    Spacer(modifier = Modifier.width(48.dp))
                }
                columns.forEach { col ->
                    Row(
                        modifier = Modifier
                            .width(col.width)
                            .then(
                                if (col.sortable) {
                                    Modifier.clickable {
                                        val newDir = if (sortColumn == col.key && sortDirection == SortDirection.Ascending) {
                                            SortDirection.Descending
                                        } else {
                                            SortDirection.Ascending
                                        }
                                        onSort(col.key, newDir)
                                    }
                                } else {
                                    Modifier
                                },
                            ),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = col.label,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        if (col.sortable && sortColumn == col.key) {
                            Icon(
                                imageVector = if (sortDirection == SortDirection.Ascending) {
                                    Icons.Filled.ArrowUpward
                                } else {
                                    Icons.Filled.ArrowDownward
                                },
                                contentDescription = sortDirection.name,
                                modifier = Modifier.padding(start = 4.dp),
                            )
                        }
                    }
                }
            }
            HorizontalDivider(thickness = 2.dp)
        }

        // Data rows
        itemsIndexed(data) { rowIndex, row ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(scrollState)
                    .padding(vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (selectable) {
                    Checkbox(
                        checked = rowIndex in selectedRows,
                        onCheckedChange = { checked ->
                            if (checked) {
                                selectedRows.add(rowIndex)
                            } else {
                                selectedRows.remove(rowIndex)
                            }
                            onSelectRow(rowIndex, checked)
                        },
                        modifier = Modifier.width(48.dp),
                    )
                }
                columns.forEach { col ->
                    Text(
                        text = row[col.key]?.toString() ?: "",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.width(col.width),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (rowIndex < data.lastIndex) {
                HorizontalDivider()
            }
        }
    }
}
