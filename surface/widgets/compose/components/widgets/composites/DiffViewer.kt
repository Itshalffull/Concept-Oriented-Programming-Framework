// ============================================================
// Clef Surface Compose Widget — DiffViewer
//
// Side-by-side or unified diff viewer for comparing two text
// versions. Displays added (green), removed (red), and
// unchanged (dimmed) lines with line numbers. Supports unified
// and split display modes. Renders with Row of two scrollable
// text columns or a single unified LazyColumn.
// Maps diff-viewer.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

private data class DiffLine(
    val type: DiffLineType,
    val oldNum: Int?,
    val newNum: Int?,
    val content: String,
)

private enum class DiffLineType { ADDED, REMOVED, UNCHANGED }

enum class DiffMode { UNIFIED, SPLIT }

// --------------- Helpers ---------------

private fun computeDiff(oldText: String, newText: String): List<DiffLine> {
    val oldLines = oldText.split("\n")
    val newLines = newText.split("\n")
    val result = mutableListOf<DiffLine>()

    var oldIdx = 0
    var newIdx = 0

    while (oldIdx < oldLines.size || newIdx < newLines.size) {
        val oldLine = oldLines.getOrNull(oldIdx)
        val newLine = newLines.getOrNull(newIdx)

        if (oldLine != null && newLine != null && oldLine == newLine) {
            result += DiffLine(DiffLineType.UNCHANGED, oldIdx + 1, newIdx + 1, oldLine)
            oldIdx++
            newIdx++
        } else if (oldLine != null && (newLine == null || oldLine != newLine)) {
            val futureNew = newLines.indexOf(oldLine).takeIf { it >= newIdx }
            if (futureNew == null || futureNew > newIdx + 3) {
                result += DiffLine(DiffLineType.REMOVED, oldIdx + 1, null, oldLine)
                oldIdx++
            } else {
                while (newIdx < futureNew) {
                    result += DiffLine(DiffLineType.ADDED, null, newIdx + 1, newLines[newIdx])
                    newIdx++
                }
            }
        } else if (newLine != null) {
            result += DiffLine(DiffLineType.ADDED, null, newIdx + 1, newLine)
            newIdx++
        }
    }
    return result
}

private fun padNum(n: Int?, width: Int): String {
    if (n == null) return " ".repeat(width)
    val s = n.toString()
    return " ".repeat((width - s.length).coerceAtLeast(0)) + s
}

// --------------- Component ---------------

/**
 * Diff viewer composable rendering a side-by-side or unified diff
 * of two text versions with color-coded additions and removals.
 *
 * @param oldText Original text (before changes).
 * @param newText Modified text (after changes).
 * @param mode Display mode: UNIFIED or SPLIT.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun DiffViewer(
    oldText: String,
    newText: String,
    mode: DiffMode = DiffMode.UNIFIED,
    modifier: Modifier = Modifier,
) {
    val diffLines = remember(oldText, newText) { computeDiff(oldText, newText) }
    val additions = remember(diffLines) { diffLines.count { it.type == DiffLineType.ADDED } }
    val deletions = remember(diffLines) { diffLines.count { it.type == DiffLineType.REMOVED } }
    val numWidth = remember(diffLines) { diffLines.size.toString().length.coerceAtLeast(3) }

    val addedColor = Color(0xFF4CAF50)
    val removedColor = Color(0xFFF44336)

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Stats Header
            Row {
                Text(
                    text = "Diff ",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Text(text = "+$additions", color = addedColor, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = "-$deletions", color = removedColor, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "[${mode.name.lowercase()}]",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            when (mode) {
                DiffMode.UNIFIED -> UnifiedDiff(diffLines, numWidth, addedColor, removedColor)
                DiffMode.SPLIT -> SplitDiff(diffLines, numWidth, addedColor, removedColor)
            }
        }
    }
}

@Composable
private fun UnifiedDiff(
    diffLines: List<DiffLine>,
    numWidth: Int,
    addedColor: Color,
    removedColor: Color,
) {
    LazyColumn {
        itemsIndexed(diffLines) { _, line ->
            val prefix = when (line.type) {
                DiffLineType.ADDED -> "+"
                DiffLineType.REMOVED -> "-"
                DiffLineType.UNCHANGED -> " "
            }
            val color = when (line.type) {
                DiffLineType.ADDED -> addedColor
                DiffLineType.REMOVED -> removedColor
                DiffLineType.UNCHANGED -> MaterialTheme.colorScheme.onSurfaceVariant
            }
            Row(modifier = Modifier.horizontalScroll(rememberScrollState())) {
                Text(
                    text = padNum(line.oldNum, numWidth) + " ",
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = padNum(line.newNum, numWidth) + " ",
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
                Text(
                    text = "$prefix ${line.content}",
                    fontFamily = FontFamily.Monospace,
                    color = color,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun SplitDiff(
    diffLines: List<DiffLine>,
    numWidth: Int,
    addedColor: Color,
    removedColor: Color,
) {
    val oldLines = remember(diffLines) { diffLines.filter { it.type != DiffLineType.ADDED } }
    val newLines = remember(diffLines) { diffLines.filter { it.type != DiffLineType.REMOVED } }
    val maxLen = maxOf(oldLines.size, newLines.size)

    // Column headers
    Row(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = "Original",
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium,
        )
        VerticalDivider(modifier = Modifier.height(20.dp).padding(horizontal = 4.dp))
        Text(
            text = "Modified",
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.labelMedium,
        )
    }
    HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

    LazyColumn {
        items(maxLen) { i ->
            val left = oldLines.getOrNull(i)
            val right = newLines.getOrNull(i)
            Row(modifier = Modifier.fillMaxWidth()) {
                // Left pane
                Box(modifier = Modifier.weight(1f)) {
                    if (left != null) {
                        val color = when (left.type) {
                            DiffLineType.REMOVED -> removedColor
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Text(
                            text = "${padNum(left.oldNum, numWidth)} ${if (left.type == DiffLineType.REMOVED) "-" else " "} ${left.content}",
                            fontFamily = FontFamily.Monospace,
                            color = color,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                        )
                    }
                }
                VerticalDivider(modifier = Modifier.height(20.dp).padding(horizontal = 4.dp))
                // Right pane
                Box(modifier = Modifier.weight(1f)) {
                    if (right != null) {
                        val color = when (right.type) {
                            DiffLineType.ADDED -> addedColor
                            else -> MaterialTheme.colorScheme.onSurfaceVariant
                        }
                        Text(
                            text = "${padNum(right.newNum, numWidth)} ${if (right.type == DiffLineType.ADDED) "+" else " "} ${right.content}",
                            fontFamily = FontFamily.Monospace,
                            color = color,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 1,
                        )
                    }
                }
            }
        }
    }
}
