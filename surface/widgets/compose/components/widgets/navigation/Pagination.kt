// ============================================================
// Clef Surface Compose Widget — Pagination
//
// Page navigation control for Jetpack Compose.
// Renders numbered page buttons with ellipsis for large ranges,
// plus previous/next icon buttons. Maps pagination.widget
// anatomy (root, prevButton, nextButton, items, item, ellipsis)
// to Row with Material 3 buttons and text.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private fun buildPageRange(
    page: Int,
    totalPages: Int,
    siblingCount: Int,
): List<Any> {
    val result = mutableListOf<Any>()

    // Always show page 1
    result.add(1)

    val rangeStart = maxOf(2, page - siblingCount)
    val rangeEnd = minOf(totalPages - 1, page + siblingCount)

    if (rangeStart > 2) {
        result.add("ellipsis")
    }

    for (i in rangeStart..rangeEnd) {
        result.add(i)
    }

    if (rangeEnd < totalPages - 1) {
        result.add("ellipsis")
    }

    // Always show last page if more than 1
    if (totalPages > 1) {
        result.add(totalPages)
    }

    return result
}

// --------------- Component ---------------

/**
 * Page navigation control with numbered buttons.
 *
 * @param page Current page (1-indexed).
 * @param totalPages Total number of pages.
 * @param siblingCount Number of sibling pages to show around current page.
 * @param onChange Callback when the page changes.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Pagination(
    page: Int,
    totalPages: Int,
    siblingCount: Int = 1,
    onChange: ((Int) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val pages = remember(page, totalPages, siblingCount) {
        buildPageRange(page, totalPages, siblingCount)
    }

    val atFirst = page <= 1
    val atLast = page >= totalPages

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Previous button
        IconButton(
            onClick = { if (!atFirst) onChange?.invoke(page - 1) },
            enabled = !atFirst,
            modifier = Modifier.size(36.dp),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                contentDescription = "Previous page",
            )
        }

        // Page items
        pages.forEachIndexed { index, entry ->
            when (entry) {
                "ellipsis" -> {
                    Text(
                        text = "...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                is Int -> {
                    val isCurrent = entry == page
                    if (isCurrent) {
                        FilledTonalButton(
                            onClick = {},
                            modifier = Modifier.size(36.dp),
                        ) {
                            Text(text = entry.toString())
                        }
                    } else {
                        OutlinedButton(
                            onClick = { onChange?.invoke(entry) },
                            modifier = Modifier.size(36.dp),
                        ) {
                            Text(text = entry.toString())
                        }
                    }
                }
            }
        }

        // Next button
        IconButton(
            onClick = { if (!atLast) onChange?.invoke(page + 1) },
            enabled = !atLast,
            modifier = Modifier.size(36.dp),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                contentDescription = "Next page",
            )
        }
    }
}
