// ============================================================
// Clef Surface Compose Widget — FileBrowser
//
// File management interface with path breadcrumb, toggleable
// list of files and folders with type icons, size, and modified
// date. Renders as a Column with a breadcrumb Row and a
// LazyColumn of file items. Tap to open folders or select files.
// Maps file-browser.widget anatomy.
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

data class FileEntry(
    val name: String,
    val type: FileEntryType,
    val size: Long,
    val modified: String,
)

enum class FileEntryType { FILE, FOLDER }

// --------------- Helpers ---------------

private fun formatSize(bytes: Long): String = when {
    bytes < 1024 -> "${bytes}B"
    bytes < 1024 * 1024 -> "${"%.1f".format(bytes / 1024.0)}K"
    else -> "${"%.1f".format(bytes / (1024.0 * 1024.0))}M"
}

// --------------- Component ---------------

/**
 * File browser composable with breadcrumb path navigation and a
 * scrollable list of file and folder entries with metadata.
 *
 * @param files Array of file and folder entries.
 * @param currentPath Current directory path.
 * @param onNavigate Callback when navigating to a folder.
 * @param onSelect Callback when selecting/opening a file.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun FileBrowser(
    files: List<FileEntry>,
    currentPath: String,
    onNavigate: ((String) -> Unit)? = null,
    onSelect: ((FileEntry) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val pathSegments = remember(currentPath) {
        currentPath.split("/").filter { it.isNotEmpty() }
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Breadcrumb
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "/",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (pathSegments.isEmpty()) {
                    Text(
                        text = " root",
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                } else {
                    pathSegments.forEachIndexed { index, segment ->
                        if (index > 0) {
                            Text(
                                text = " / ",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        } else {
                            Text(text = " ", style = MaterialTheme.typography.bodyMedium)
                        }
                        val isLast = index == pathSegments.lastIndex
                        Text(
                            text = segment,
                            fontWeight = if (isLast) FontWeight.Bold else FontWeight.Normal,
                            modifier = if (!isLast) {
                                Modifier.clickable {
                                    val path = "/" + pathSegments.take(index + 1).joinToString("/")
                                    onNavigate?.invoke(path)
                                }
                            } else Modifier,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Table Header
            Row(modifier = Modifier.fillMaxWidth()) {
                Spacer(modifier = Modifier.width(28.dp))
                Text("Name", modifier = Modifier.weight(2f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Size", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
                Text("Modified", modifier = Modifier.weight(1f), fontWeight = FontWeight.Bold, style = MaterialTheme.typography.labelMedium)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // File Entries
            if (files.isEmpty()) {
                Text(
                    text = "Empty directory.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                LazyColumn {
                    itemsIndexed(files) { _, file ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    if (file.type == FileEntryType.FOLDER) {
                                        val newPath = if (currentPath.endsWith("/"))
                                            "$currentPath${file.name}"
                                        else
                                            "$currentPath/${file.name}"
                                        onNavigate?.invoke(newPath)
                                    } else {
                                        onSelect?.invoke(file)
                                    }
                                }
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = if (file.type == FileEntryType.FOLDER) "\uD83D\uDCC1" else "\uD83D\uDCC4",
                                modifier = Modifier.width(28.dp),
                            )
                            Text(
                                text = file.name,
                                modifier = Modifier.weight(2f),
                                fontWeight = FontWeight.Normal,
                                color = if (file.type == FileEntryType.FOLDER)
                                    MaterialTheme.colorScheme.primary
                                else
                                    MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                text = if (file.type == FileEntryType.FOLDER) "--" else formatSize(file.size),
                                modifier = Modifier.weight(1f),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                text = file.modified,
                                modifier = Modifier.weight(1f),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                }
            }
        }
    }
}
