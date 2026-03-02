// ============================================================
// Clef Surface Compose Widget — FacetedSearch
//
// Full-featured search interface with a text query TextField,
// facet filters in a Column with checkbox toggles, and a
// results list on the right. Supports grouped facet options
// and active filter display. Renders with Row splitting
// facets sidebar and results list.
// Maps faceted-search.widget anatomy.
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

data class FacetOption(
    val label: String,
    val value: String,
    val selected: Boolean = false,
)

data class Facet(
    val name: String,
    val options: List<FacetOption>,
)

data class SearchResult(
    val id: String,
    val title: String,
    val description: String? = null,
)

// --------------- Component ---------------

/**
 * Faceted search composable with a query input, grouped facet
 * checkboxes on the left, and a scrollable results list on the right.
 *
 * @param query Current search query string.
 * @param facets Array of facet filter groups.
 * @param results Array of search results.
 * @param onQueryChange Callback when the query text changes.
 * @param onFacetChange Callback when a facet option is toggled.
 * @param onSelect Callback when a search result is selected.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun FacetedSearch(
    query: String,
    facets: List<Facet>,
    results: List<SearchResult>,
    onQueryChange: ((String) -> Unit)? = null,
    onFacetChange: ((facetName: String, optionValue: String, selected: Boolean) -> Unit)? = null,
    onSelect: ((SearchResult) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Search Input
            OutlinedTextField(
                value = query,
                onValueChange = { onQueryChange?.invoke(it) },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Search") },
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                // Facet Sidebar
                Column(modifier = Modifier.width(200.dp)) {
                    Text(
                        text = "Filters",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    if (facets.isEmpty()) {
                        Text(
                            text = "No filters",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }

                    facets.forEach { facet ->
                        Text(
                            text = facet.name,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                        )
                        facet.options.forEach { option ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        onFacetChange?.invoke(facet.name, option.value, !option.selected)
                                    }
                                    .padding(vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Checkbox(
                                    checked = option.selected,
                                    onCheckedChange = {
                                        onFacetChange?.invoke(facet.name, option.value, it)
                                    },
                                    modifier = Modifier.size(20.dp),
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(
                                    text = option.label,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.width(16.dp))
                VerticalDivider(modifier = Modifier.height(IntrinsicSize.Max))
                Spacer(modifier = Modifier.width(16.dp))

                // Results List
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Results (${results.size})",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(modifier = Modifier.height(8.dp))

                    if (results.isEmpty()) {
                        Text(
                            text = "No results found.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            itemsIndexed(results) { _, result ->
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { onSelect?.invoke(result) }
                                        .padding(vertical = 4.dp),
                                ) {
                                    Text(
                                        text = result.title,
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = FontWeight.Medium,
                                    )
                                    if (result.description != null) {
                                        Text(
                                            text = result.description,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
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
