// ============================================================
// Clef Surface Compose Widget — CommandPalette
//
// Modal search overlay for rapid command execution in Compose.
// Provides a search TextField at top with filtered results
// below in a scrollable list. Selecting an item triggers
// onSelect, pressing escape or backdrop closes the palette.
// Maps command-palette.widget anatomy (root, backdrop, input,
// list, group, item, etc.) to Dialog with Column layout.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog

// --------------- Types ---------------

data class CommandPaletteItem(
    val id: String,
    val label: String,
    val shortcut: String? = null,
    val group: String? = null,
)

// --------------- Component ---------------

/**
 * Modal search overlay for rapid command execution.
 *
 * @param open Whether the palette is visible.
 * @param items Available command items.
 * @param placeholder Placeholder text for the search input.
 * @param onSelect Callback when an item is selected.
 * @param onClose Callback when the palette is dismissed.
 * @param modifier Modifier for the dialog surface.
 */
@Composable
fun CommandPalette(
    open: Boolean,
    items: List<CommandPaletteItem>,
    placeholder: String = "Type a command...",
    onSelect: ((CommandPaletteItem) -> Unit)? = null,
    onClose: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (!open) return

    var query by remember { mutableStateOf("") }

    val filtered = remember(items, query) {
        if (query.isBlank()) items
        else items.filter { it.label.contains(query, ignoreCase = true) }
    }

    val grouped = remember(filtered) {
        filtered.groupBy { it.group ?: "" }
    }

    Dialog(onDismissRequest = { onClose?.invoke() }) {
        Surface(
            modifier = modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 6.dp,
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                // Search input
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text(placeholder) },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Filled.Search,
                            contentDescription = "Search",
                        )
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                // Results
                if (filtered.isEmpty()) {
                    Text(
                        text = "No results found.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 12.dp),
                    )
                } else {
                    LazyColumn(modifier = Modifier.heightIn(max = 300.dp)) {
                        grouped.forEach { (group, groupItems) ->
                            if (group.isNotEmpty()) {
                                item(key = "group-$group") {
                                    Text(
                                        text = group,
                                        style = MaterialTheme.typography.labelMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.padding(
                                            top = 12.dp,
                                            bottom = 4.dp,
                                            start = 8.dp,
                                        ),
                                    )
                                }
                            }

                            items(
                                items = groupItems,
                                key = { it.id },
                            ) { commandItem ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onSelect?.invoke(commandItem) }
                                        .padding(horizontal = 8.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Text(
                                        text = commandItem.label,
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.weight(1f),
                                    )
                                    if (commandItem.shortcut != null) {
                                        Text(
                                            text = commandItem.shortcut,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
