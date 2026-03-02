// ============================================================
// Clef Surface Compose Widget — TreeSelect
//
// Hierarchical tree with expand/collapse toggles and checkbox
// selection rendered using LazyColumn. Nodes are indented by
// depth, parent nodes have expand/collapse arrow indicators,
// and each node has a Checkbox for selection. Supports single
// and multiple selection modes.
//
// Adapts the tree-select.widget spec: anatomy (root, item,
// itemToggle, itemCheckbox, itemLabel, itemChildren), states
// (item, selection, focus), and connect attributes to Compose
// rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class TreeNode(
    /** Unique identifier. */
    val id: String,
    /** Display label. */
    val label: String,
    /** Optional children nodes. */
    val children: List<TreeNode> = emptyList(),
)

// --------------- Helpers ---------------

private data class FlatNode(
    val node: TreeNode,
    val depth: Int,
    val hasChildren: Boolean,
)

private fun flattenTree(
    nodes: List<TreeNode>,
    expandedSet: Set<String>,
    depth: Int = 0,
): List<FlatNode> {
    val result = mutableListOf<FlatNode>()
    for (node in nodes) {
        val hasChildren = node.children.isNotEmpty()
        result.add(FlatNode(node, depth, hasChildren))
        if (hasChildren && node.id in expandedSet) {
            result.addAll(flattenTree(node.children, expandedSet, depth + 1))
        }
    }
    return result
}

// --------------- Component ---------------

/**
 * TreeSelect composable that renders a hierarchical tree with
 * expand/collapse controls and checkbox selection using LazyColumn.
 *
 * @param value Selected value(s). Single string or list for multiple.
 * @param nodes Tree data structure.
 * @param multiple Whether multiple nodes can be selected.
 * @param initialExpanded Initially expanded node IDs.
 * @param enabled Whether the tree is enabled.
 * @param label Visible label above the tree.
 * @param onSelectionChange Callback when selection changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun TreeSelect(
    value: List<String> = emptyList(),
    nodes: List<TreeNode> = emptyList(),
    multiple: Boolean = false,
    initialExpanded: List<String> = emptyList(),
    enabled: Boolean = true,
    label: String? = null,
    onSelectionChange: ((List<String>) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var expandedSet by remember { mutableStateOf(initialExpanded.toSet()) }
    var selectedSet by remember { mutableStateOf(value.toSet()) }

    LaunchedEffect(value) {
        selectedSet = value.toSet()
    }

    val flatNodes = remember(nodes, expandedSet) {
        flattenTree(nodes, expandedSet)
    }

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Label --
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )
        }

        if (flatNodes.isEmpty()) {
            Text(
                text = "(empty tree)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                itemsIndexed(flatNodes) { _, flat ->
                    val isSelected = flat.node.id in selectedSet
                    val isExpanded = flat.node.id in expandedSet
                    val indent = flat.depth * 24

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(start = indent.dp)
                            .clickable(enabled = enabled) {
                                // Toggle selection
                                val newSelected = if (multiple) {
                                    if (isSelected) {
                                        selectedSet - flat.node.id
                                    } else {
                                        selectedSet + flat.node.id
                                    }
                                } else {
                                    if (isSelected) emptySet() else setOf(flat.node.id)
                                }
                                selectedSet = newSelected
                                onSelectionChange?.invoke(newSelected.toList())
                            },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        // -- Expand/collapse toggle --
                        if (flat.hasChildren) {
                            IconButton(
                                onClick = {
                                    expandedSet = if (isExpanded) {
                                        expandedSet - flat.node.id
                                    } else {
                                        expandedSet + flat.node.id
                                    }
                                },
                                enabled = enabled,
                                modifier = Modifier.size(32.dp),
                            ) {
                                Icon(
                                    imageVector = if (isExpanded) {
                                        Icons.Filled.ExpandMore
                                    } else {
                                        Icons.Filled.ChevronRight
                                    },
                                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                                    tint = MaterialTheme.colorScheme.primary.copy(
                                        alpha = disabledAlpha,
                                    ),
                                )
                            }
                        } else {
                            Spacer(modifier = Modifier.size(32.dp))
                        }

                        // -- Checkbox --
                        Checkbox(
                            checked = isSelected,
                            onCheckedChange = if (enabled) {
                                { checked ->
                                    val newSelected = if (multiple) {
                                        if (checked) {
                                            selectedSet + flat.node.id
                                        } else {
                                            selectedSet - flat.node.id
                                        }
                                    } else {
                                        if (checked) setOf(flat.node.id) else emptySet()
                                    }
                                    selectedSet = newSelected
                                    onSelectionChange?.invoke(newSelected.toList())
                                }
                            } else {
                                null
                            },
                            enabled = enabled,
                        )

                        // -- Label --
                        Text(
                            text = flat.node.label,
                            style = MaterialTheme.typography.bodyMedium,
                            color = when {
                                isSelected -> MaterialTheme.colorScheme.primary.copy(
                                    alpha = disabledAlpha,
                                )
                                else -> MaterialTheme.colorScheme.onSurface.copy(
                                    alpha = disabledAlpha,
                                )
                            },
                            modifier = Modifier.padding(start = 4.dp),
                        )
                    }
                }
            }
        }
    }
}
