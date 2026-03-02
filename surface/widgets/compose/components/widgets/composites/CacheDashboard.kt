// ============================================================
// Clef Surface Compose Widget — CacheDashboard
//
// Cache monitoring dashboard displaying hit/miss ratio, memory
// usage progress bar, and a list of cache entries with key,
// size, TTL, and hit counts. Provides evict and clear actions.
// Renders with Material 3 cards, LinearProgressIndicator, and
// a LazyColumn for entry rows.
// Maps cache-dashboard.widget anatomy.
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class CacheEntry(
    val key: String,
    val size: Long,
    val ttl: Int,
    val hits: Int,
)

// --------------- Helpers ---------------

private fun formatBytes(bytes: Long): String = when {
    bytes < 1024 -> "${bytes}B"
    bytes < 1024 * 1024 -> "${"%.1f".format(bytes / 1024.0)}KB"
    else -> "${"%.1f".format(bytes / (1024.0 * 1024.0))}MB"
}

// --------------- Component ---------------

/**
 * Cache dashboard composable showing hit rate, memory usage bar,
 * and a table of cache entries with evict and clear-all actions.
 *
 * @param entries Array of cache entries.
 * @param totalSize Total size of all cached data in bytes.
 * @param maxSize Maximum cache capacity in bytes.
 * @param hitRate Overall cache hit rate (0.0 - 1.0).
 * @param onEvict Callback to evict a specific cache entry by key.
 * @param onClear Callback to clear the entire cache.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun CacheDashboard(
    entries: List<CacheEntry>,
    totalSize: Long,
    maxSize: Long,
    hitRate: Float,
    onEvict: ((String) -> Unit)? = null,
    onClear: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val usageRatio = if (maxSize > 0) totalSize.toFloat() / maxSize else 0f

    val hitRateColor = when {
        hitRate >= 0.8f -> MaterialTheme.colorScheme.primary
        hitRate >= 0.5f -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.error
    }

    val usageColor = when {
        usageRatio >= 0.9f -> MaterialTheme.colorScheme.error
        usageRatio >= 0.7f -> MaterialTheme.colorScheme.tertiary
        else -> MaterialTheme.colorScheme.primary
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Stats Header
            Text(
                text = "Cache Dashboard",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = "Hit Rate: ", style = MaterialTheme.typography.bodyMedium)
                Text(
                    text = "${"%.1f".format(hitRate * 100)}%",
                    color = hitRateColor,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = "Usage: ", style = MaterialTheme.typography.bodyMedium)
                LinearProgressIndicator(
                    progress = { usageRatio.coerceIn(0f, 1f) },
                    modifier = Modifier.weight(1f).height(8.dp),
                    color = usageColor,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "${formatBytes(totalSize)}/${formatBytes(maxSize)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Table Header
            Row(modifier = Modifier.fillMaxWidth()) {
                Text("Key", modifier = Modifier.weight(2f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Size", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("TTL", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Hits", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Spacer(modifier = Modifier.width(48.dp))
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Entry Rows
            if (entries.isEmpty()) {
                Text(
                    text = "No cache entries.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                LazyColumn {
                    itemsIndexed(entries) { _, entry ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = entry.key,
                                modifier = Modifier.weight(2f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(formatBytes(entry.size), modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            Text("${entry.ttl}s", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            Text("${entry.hits}", modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            TextButton(
                                onClick = { onEvict?.invoke(entry.key) },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                            ) {
                                Text("Evict", style = MaterialTheme.typography.labelSmall)
                            }
                        }
                    }
                }
            }

            // Clear All Button
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(
                onClick = { onClear?.invoke() },
                colors = ButtonDefaults.outlinedButtonColors(
                    contentColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Text("Clear All")
            }
        }
    }
}
