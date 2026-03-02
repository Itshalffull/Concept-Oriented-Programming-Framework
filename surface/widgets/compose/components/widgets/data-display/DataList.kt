// ============================================================
// Clef Surface Compose Widget — DataList
//
// Key-value pair display rendering a list of labelled data
// fields. Each item consists of a term (label) and a detail
// (value). Supports horizontal and vertical layout orientations.
// Compose adaptation: LazyColumn with HorizontalDivider between
// rows, or FlowRow for horizontal orientation.
// See widget spec: repertoire/widgets/data-display/data-list.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class DataListItem(
    val label: String,
    val value: String,
)

/** Layout orientation for the data list. */
enum class DataListOrientation {
    Vertical,
    Horizontal,
}

// --------------- Component ---------------

/**
 * Key-value pair list displaying labelled data fields.
 *
 * @param items Array of label-value pairs to display.
 * @param orientation Layout orientation for the list.
 * @param modifier Modifier for the root layout.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DataList(
    items: List<DataListItem>,
    orientation: DataListOrientation = DataListOrientation.Vertical,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) {
        Text(
            text = "No data",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = modifier,
        )
        return
    }

    when (orientation) {
        DataListOrientation.Horizontal -> {
            FlowRow(
                modifier = modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(24.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items.forEach { item ->
                    Column {
                        Text(
                            text = item.label,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = item.value,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }
        }

        DataListOrientation.Vertical -> {
            LazyColumn(modifier = modifier.fillMaxWidth()) {
                itemsIndexed(items) { index, item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(
                            text = item.label,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = item.value,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                    if (index < items.lastIndex) {
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
