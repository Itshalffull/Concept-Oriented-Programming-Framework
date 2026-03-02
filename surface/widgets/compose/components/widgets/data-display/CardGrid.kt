// ============================================================
// Clef Surface Compose Widget — CardGrid
//
// Responsive grid layout for displaying a collection of cards
// in a multi-column arrangement. Compose adaptation: uses
// LazyVerticalGrid with a configurable fixed column count
// and gap spacing between items.
// See widget spec: repertoire/widgets/data-display/card-grid.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Grid layout rendering a collection of items as cards in a multi-column arrangement.
 *
 * @param columns Number of columns for the grid layout.
 * @param gap Spacing between grid items.
 * @param modifier Modifier for the root layout.
 * @param items List of data items to render in the grid.
 * @param itemContent Composable factory for each grid cell.
 */
@Composable
fun <T> CardGrid(
    items: List<T>,
    columns: Int = 3,
    gap: Dp = 8.dp,
    modifier: Modifier = Modifier,
    itemContent: @Composable (T) -> Unit,
) {
    if (items.isEmpty()) {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = "No items to display",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        return
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(columns),
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(gap),
        verticalArrangement = Arrangement.spacedBy(gap),
    ) {
        items(items) { item ->
            itemContent(item)
        }
    }
}
