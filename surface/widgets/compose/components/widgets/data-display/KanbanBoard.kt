// ============================================================
// Clef Surface Compose Widget — KanbanBoard
//
// Column-based board for organising items into categorical lanes.
// Each column represents a status or grouping with cards that
// can be tapped or dragged between columns. Compose adaptation:
// LazyRow of columns, each containing a LazyColumn of item cards.
// See widget spec: repertoire/widgets/data-display/kanban-board.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class KanbanItem(
    val id: String,
    val title: String,
    val description: String? = null,
)

data class KanbanColumn(
    val id: String,
    val title: String,
    val items: List<KanbanItem>,
)

// --------------- Component ---------------

/**
 * Column-based Kanban board with horizontally scrollable lanes.
 *
 * @param columns Columns with their items.
 * @param columnWidth Width of each column lane.
 * @param onItemClick Callback when an item card is tapped.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun KanbanBoard(
    columns: List<KanbanColumn>,
    columnWidth: Dp = 240.dp,
    onItemClick: (columnId: String, itemId: String) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    if (columns.isEmpty()) {
        Text(
            text = "No columns",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier.padding(16.dp),
        )
        return
    }

    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        items(columns, key = { it.id }) { column ->
            OutlinedCard(
                modifier = Modifier
                    .width(columnWidth)
                    .fillMaxHeight(),
                colors = CardDefaults.outlinedCardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerLow,
                ),
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    // Column header
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = column.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = "${column.items.size}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    Spacer(modifier = Modifier.height(4.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(8.dp))

                    // Items
                    if (column.items.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .height(48.dp)
                                .align(Alignment.CenterHorizontally),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "(empty)",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            itemsIndexed(
                                column.items,
                                key = { _, item -> item.id },
                            ) { _, item ->
                                OutlinedCard(
                                    onClick = { onItemClick(column.id, item.id) },
                                    modifier = Modifier.width(columnWidth - 24.dp),
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text(
                                            text = item.title,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Medium,
                                            maxLines = 2,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        if (item.description != null) {
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text(
                                                text = item.description,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 3,
                                                overflow = TextOverflow.Ellipsis,
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
