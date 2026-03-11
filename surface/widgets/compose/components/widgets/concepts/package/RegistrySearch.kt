package com.clef.surface.widgets.concepts.pkg

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class RegistrySearchState { Idle, Searching }

sealed class RegistrySearchEvent {
    object Input : RegistrySearchEvent()
    object SelectResult : RegistrySearchEvent()
    object Results : RegistrySearchEvent()
    object Clear : RegistrySearchEvent()
}

fun registrySearchReduce(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState = when (state) {
    RegistrySearchState.Idle -> when (event) {
        is RegistrySearchEvent.Input -> RegistrySearchState.Searching
        is RegistrySearchEvent.SelectResult -> RegistrySearchState.Idle
        else -> state
    }
    RegistrySearchState.Searching -> when (event) {
        is RegistrySearchEvent.Results -> RegistrySearchState.Idle
        is RegistrySearchEvent.Clear -> RegistrySearchState.Idle
        else -> state
    }
}

// --- Types ---

data class RegistrySearchResult(
    val name: String,
    val version: String,
    val description: String,
    val downloads: Int? = null,
    val author: String? = null,
    val keywords: List<String> = emptyList()
)

// --- Helpers ---

private fun formatDownloads(count: Int): String = when {
    count >= 1_000_000 -> "${"%.1f".format(count / 1_000_000f)}M"
    count >= 1_000 -> "${"%.1f".format(count / 1_000f)}K"
    else -> count.toString()
}

@Composable
fun RegistrySearch(
    query: String,
    results: List<RegistrySearchResult>,
    modifier: Modifier = Modifier,
    loading: Boolean = false,
    placeholder: String = "Search packages\u2026",
    pageSize: Int = 20,
    onSearch: (String) -> Unit = {},
    onSelect: (String) -> Unit = {},
    onKeywordClick: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(RegistrySearchState.Idle) }
    var internalQuery by remember { mutableStateOf(query) }
    var page by remember { mutableIntStateOf(0) }

    // Sync query prop
    LaunchedEffect(query) { internalQuery = query }

    // Transition to idle when results arrive
    LaunchedEffect(results, loading) {
        if (state == RegistrySearchState.Searching && !loading) {
            state = registrySearchReduce(state, RegistrySearchEvent.Results)
        }
    }

    val totalPages = maxOf(1, (results.size + pageSize - 1) / pageSize)
    val paginatedResults = remember(results, page, pageSize) {
        val start = page * pageSize
        results.subList(start, minOf(start + pageSize, results.size))
    }

    Column(modifier = modifier.semantics { contentDescription = "Package registry search" }) {
        // Search input
        OutlinedTextField(
            value = internalQuery,
            onValueChange = {
                internalQuery = it
                page = 0
                if (it.trim().isNotEmpty()) {
                    state = registrySearchReduce(state, RegistrySearchEvent.Input)
                    onSearch(it)
                } else {
                    state = registrySearchReduce(state, RegistrySearchEvent.Clear)
                    onSearch("")
                }
            },
            placeholder = { Text(placeholder) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
        )

        // Loading indicator
        if (loading) {
            Text("Loading results\u2026", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Result list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(paginatedResults) { _, result ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp)
                        .clickable {
                            state = registrySearchReduce(state, RegistrySearchEvent.SelectResult)
                            onSelect(result.name)
                        }
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Text(result.name, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            Text(result.version, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Spacer(Modifier.weight(1f))
                            if (result.downloads != null) {
                                Text(
                                    formatDownloads(result.downloads),
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }

                        Text(result.description, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))

                        if (result.author != null) {
                            Text(result.author, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
                        }

                        if (result.keywords.isNotEmpty()) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                modifier = Modifier.padding(top = 4.dp)
                            ) {
                                result.keywords.take(5).forEach { kw ->
                                    Surface(
                                        tonalElevation = 2.dp,
                                        shape = MaterialTheme.shapes.small,
                                        modifier = Modifier.clickable { onKeywordClick(kw) }
                                    ) {
                                        Text(kw, fontSize = 10.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Empty states
            if (!loading && internalQuery.trim().isNotEmpty() && results.isEmpty()) {
                item {
                    Text(
                        "No packages found for \u201C$internalQuery\u201D. Try a different search term.",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            if (!loading && internalQuery.trim().isEmpty() && results.isEmpty()) {
                item {
                    Text(
                        "Enter a search term to find packages.",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Pagination
        if (totalPages > 1) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 8.dp)
            ) {
                TextButton(onClick = { page = maxOf(0, page - 1) }, enabled = page > 0) {
                    Text("Previous")
                }
                Text("Page ${page + 1} of $totalPages", fontSize = 12.sp)
                TextButton(onClick = { page = minOf(totalPages - 1, page + 1) }, enabled = page < totalPages - 1) {
                    Text("Next")
                }
            }
        }
    }
}
