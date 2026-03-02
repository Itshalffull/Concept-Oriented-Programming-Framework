// ============================================================
// Clef Surface Compose Widget — FileUpload
//
// File selection area with a dashed drop-zone border, a browse
// button, and a file list showing name, size, and a remove
// action. Displays accepted file types and max-size constraints.
//
// Adapts the file-upload.widget spec: anatomy (root, dropzone,
// dropzoneLabel, fileList, fileItem, fileName, fileSize,
// fileRemove), states (dropzone, upload, fileItem), and connect
// attributes to Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.UploadFile
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class FileInfo(
    /** File name. */
    val name: String,
    /** File size in bytes. */
    val size: Long,
)

// --------------- Helpers ---------------

private fun formatFileSize(bytes: Long): String = when {
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "${"%.1f".format(bytes / 1024.0)} KB"
    else -> "${"%.1f".format(bytes / (1024.0 * 1024.0))} MB"
}

// --------------- Component ---------------

/**
 * FileUpload composable that renders a drop-zone area with a file
 * list. Users can trigger a browse action and see/remove selected
 * files. In Compose, the actual file picker integration is left to
 * the host activity; this component provides the visual layout.
 *
 * @param accept Accepted file type extensions (e.g. listOf(".png", ".jpg")).
 * @param maxSize Maximum file size in bytes.
 * @param multiple Whether multiple files can be selected.
 * @param enabled Whether the upload area is enabled.
 * @param files Currently selected files (controlled).
 * @param onBrowse Callback when the browse area is tapped.
 * @param onRemove Callback when a file is removed by index.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun FileUpload(
    accept: List<String>? = null,
    maxSize: Long? = null,
    multiple: Boolean = false,
    enabled: Boolean = true,
    files: List<FileInfo> = emptyList(),
    onBrowse: (() -> Unit)? = null,
    onRemove: ((Int) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val disabledAlpha = if (enabled) 1f else 0.38f
    val acceptStr = accept?.joinToString(", ") ?: "*"

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // -- Drop zone area --
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(
                    width = 2.dp,
                    color = MaterialTheme.colorScheme.outline.copy(alpha = disabledAlpha),
                    shape = RoundedCornerShape(12.dp),
                )
                .clickable(enabled = enabled) { onBrowse?.invoke() }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(
                Icons.Filled.UploadFile,
                contentDescription = "Upload file",
                modifier = Modifier.size(40.dp),
                tint = MaterialTheme.colorScheme.primary.copy(alpha = disabledAlpha),
            )

            Text(
                text = "Tap to browse or drop files here",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )

            Text(
                text = buildString {
                    append("Accepts: $acceptStr")
                    if (maxSize != null) append(" (max ${formatFileSize(maxSize)})")
                    if (multiple) append(" [multiple]")
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha * 0.7f),
            )
        }

        // -- File list --
        if (files.isNotEmpty()) {
            Text(
                text = "${files.size} file${if (files.size != 1) "s" else ""} selected",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )

            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                itemsIndexed(files) { index, file ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(
                                alpha = disabledAlpha,
                            ),
                        ),
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = file.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    text = formatFileSize(file.size),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }

                            IconButton(
                                onClick = { onRemove?.invoke(index) },
                                enabled = enabled,
                            ) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "Remove file",
                                    tint = MaterialTheme.colorScheme.error.copy(alpha = disabledAlpha),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
