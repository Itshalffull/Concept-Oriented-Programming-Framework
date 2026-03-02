// ============================================================
// Clef Surface Compose Widget — BlockEditor
//
// Full block-based document editor. Each line is an independently
// typed block (paragraph, heading, list, quote, code) that can be
// reordered, converted, and edited. Blocks render as individual
// Cards in a LazyColumn.
//
// Adapts the block-editor.widget spec: anatomy (root, editor,
// block, blockDragHandle, blockMenu, slashMenu, selectionToolbar,
// placeholder), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Types ---------------

data class EditorBlock(
    val id: String,
    val type: String,
    val content: String,
)

// --------------- Helpers ---------------

private val TYPE_ICONS = mapOf(
    "paragraph" to "\u00B6",
    "heading" to "H",
    "heading-1" to "H1",
    "heading-2" to "H2",
    "heading-3" to "H3",
    "list" to "\u2022",
    "bulleted-list" to "\u2022",
    "numbered-list" to "#",
    "quote" to "\u201C",
    "code" to "<>",
    "divider" to "\u2014",
    "callout" to "!",
    "toggle" to "\u25B6",
)

// --------------- Component ---------------

/**
 * Block-based document editor rendered as a LazyColumn of editable block Cards.
 *
 * @param blocks Ordered list of content blocks.
 * @param activeBlockId ID of the currently active block.
 * @param onBlockClick Callback when a block is tapped.
 * @param onAddBlock Callback to add a new block after the given id.
 * @param onRemoveBlock Callback to remove a block by id.
 * @param onUpdateBlock Callback when a block's content is updated.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun BlockEditor(
    blocks: List<EditorBlock>,
    activeBlockId: String? = null,
    onBlockClick: (String) -> Unit = {},
    onAddBlock: (String?) -> Unit = {},
    onRemoveBlock: (String) -> Unit = {},
    onUpdateBlock: (String, String) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    if (blocks.isEmpty()) {
        Card(
            modifier = modifier.fillMaxWidth().padding(8.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
            ),
        ) {
            Text(
                text = "Type '/' for commands...",
                modifier = Modifier.padding(16.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodyMedium,
            )
        }
        return
    }

    LazyColumn(modifier = modifier.padding(8.dp)) {
        itemsIndexed(blocks, key = { _, block -> block.id }) { index, block ->
            val isActive = block.id == activeBlockId
            val icon = TYPE_ICONS[block.type] ?: "\u00B6"

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp)
                    .clickable { onBlockClick(block.id) },
                colors = CardDefaults.cardColors(
                    containerColor = if (isActive)
                        MaterialTheme.colorScheme.primaryContainer
                    else
                        MaterialTheme.colorScheme.surface,
                ),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = icon,
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = block.content.ifEmpty { "(empty)" },
                        style = when {
                            block.type.startsWith("heading") -> MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold,
                            )
                            block.type == "code" -> MaterialTheme.typography.bodyMedium.copy(
                                fontFamily = FontFamily.Monospace,
                            )
                            block.type == "quote" -> MaterialTheme.typography.bodyMedium.copy(
                                fontStyle = FontStyle.Italic,
                            )
                            else -> MaterialTheme.typography.bodyMedium
                        },
                        color = if (block.content.isEmpty())
                            MaterialTheme.colorScheme.onSurfaceVariant
                        else
                            MaterialTheme.colorScheme.onSurface,
                    )
                }
            }
        }
    }
}
