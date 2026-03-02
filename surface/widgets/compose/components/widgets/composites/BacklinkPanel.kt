// ============================================================
// Clef Surface Compose Widget — BacklinkPanel
//
// Incoming reference panel displaying pages or blocks linking
// to the current document. Shows linked references with source
// breadcrumb and context snippet. Renders as a bordered Column
// with a LazyColumn of backlink items, each showing title,
// source path, and excerpt text.
// Maps backlink-panel.widget anatomy.
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Backlink(
    val title: String,
    val source: String,
    val excerpt: String,
)

// --------------- Component ---------------

/**
 * Backlink panel composable displaying a list of incoming references
 * to the current document, each with title, source path, and excerpt.
 *
 * @param backlinks Array of backlink references.
 * @param onSelect Callback when a backlink is tapped.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun BacklinkPanel(
    backlinks: List<Backlink>,
    onSelect: ((Backlink) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row {
                Text(
                    text = "Backlinks",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(${backlinks.size})",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (backlinks.isEmpty()) {
                Text(
                    text = "No backlinks found.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    itemsIndexed(backlinks) { _, backlink ->
                        BacklinkItem(
                            backlink = backlink,
                            onClick = { onSelect?.invoke(backlink) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BacklinkItem(
    backlink: Backlink,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
    ) {
        Row {
            Text(
                text = "\u2192 ",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
            Text(
                text = backlink.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = "(${backlink.source})",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        Text(
            text = backlink.excerpt,
            modifier = Modifier.padding(start = 24.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
