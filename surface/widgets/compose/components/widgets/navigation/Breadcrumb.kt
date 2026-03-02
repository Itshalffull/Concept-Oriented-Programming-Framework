// ============================================================
// Clef Surface Compose Widget — Breadcrumb
//
// Hierarchical location trail for Jetpack Compose.
// Renders a horizontal path like "Home > Products > Item"
// with dimmed non-current items and bold for the current page.
// Maps breadcrumb.widget anatomy (root, list, item, link,
// separator, currentPage) to Row with Text composables.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class BreadcrumbItem(
    val label: String,
    val href: String? = null,
    val current: Boolean? = null,
)

// --------------- Component ---------------

/**
 * Hierarchical location trail.
 *
 * @param items Ordered breadcrumb trail items.
 * @param separator Separator character between items.
 * @param onItemClick Callback when a non-current item is clicked.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Breadcrumb(
    items: List<BreadcrumbItem>,
    separator: String = "\u203A",
    onItemClick: ((BreadcrumbItem) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (items.isEmpty()) return

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEachIndexed { index, item ->
            val isLast = index == items.lastIndex
            val isCurrent = item.current ?: isLast

            if (isCurrent) {
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            } else {
                Text(
                    text = item.label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.clickable { onItemClick?.invoke(item) },
                )
            }

            if (!isLast) {
                Text(
                    text = " $separator ",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 4.dp),
                )
            }
        }
    }
}
