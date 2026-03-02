// ============================================================
// Clef Surface Compose Widget — SlashMenu
//
// Filterable block-type palette triggered by "/" input in a
// block editor. Renders as a DropdownMenu with a search field
// and filterable list of items. Selecting an item invokes the
// callback.
//
// Adapts the slash-menu.widget spec: anatomy (root, input,
// groups, group, groupLabel, item, itemIcon, itemLabel,
// itemDescription), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class SlashMenuItem(
    val id: String,
    val label: String,
    val description: String? = null,
    val shortcut: String? = null,
)

// --------------- Component ---------------

/**
 * Slash command menu triggered by "/" input.
 *
 * @param query Initial filter query.
 * @param items Available menu items.
 * @param onSelect Callback when an item is selected.
 * @param onClose Callback when the menu is dismissed.
 * @param modifier Modifier for the root Surface.
 */
@Composable
fun SlashMenu(
    query: String = "",
    items: List<SlashMenuItem>,
    onSelect: (SlashMenuItem) -> Unit = {},
    onClose: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var localQuery by remember(query) { mutableStateOf(query) }
    var highlightIndex by remember { mutableIntStateOf(0) }

    val filtered by remember(items, localQuery) {
        derivedStateOf {
            if (localQuery.isBlank()) items
            else {
                val lower = localQuery.lowercase()
                items.filter { item ->
                    item.label.lowercase().contains(lower) ||
                        (item.description?.lowercase()?.contains(lower) == true)
                }
            }
        }
    }

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.medium,
        tonalElevation = 4.dp,
        shadowElevation = 4.dp,
    ) {
        Column(modifier = Modifier.padding(8.dp)) {
            // Search input
            OutlinedTextField(
                value = localQuery,
                onValueChange = {
                    localQuery = it
                    highlightIndex = 0
                },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("/ Filter...") },
                singleLine = true,
                leadingIcon = {
                    Text(
                        text = "/",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                },
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Results
            if (filtered.isEmpty()) {
                Text(
                    text = "No matching commands.",
                    modifier = Modifier.padding(12.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                LazyColumn {
                    itemsIndexed(filtered) { index, item ->
                        val isHighlighted = index == highlightIndex

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 1.dp)
                                .clickable { onSelect(item) },
                            colors = CardDefaults.cardColors(
                                containerColor = if (isHighlighted)
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
                                    text = item.label,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Normal,
                                )
                                if (item.description != null) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = item.description,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.weight(1f),
                                    )
                                }
                                if (item.shortcut != null) {
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "[${item.shortcut}]",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.tertiary,
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
