package com.clef.surface.widgets.concepts.pkg

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class RegistrySearchState { Idle, Searching }

sealed class RegistrySearchEvent {
    object Search : RegistrySearchEvent()
    object SearchComplete : RegistrySearchEvent()
}

fun registrySearchReduce(
    state: RegistrySearchState,
    event: RegistrySearchEvent
): RegistrySearchState = when (state) {
    RegistrySearchState.Idle -> when (event) {
        is RegistrySearchEvent.Search -> RegistrySearchState.Searching
        else -> state
    }
    RegistrySearchState.Searching -> when (event) {
        is RegistrySearchEvent.SearchComplete -> RegistrySearchState.Idle
        else -> state
    }
}

// --- Public types ---

data class RegistrySearchResult(
    val name: String,
    val version: String,
    val description: String? = null,
    val downloads: Long? = null,
    val author: String? = null
)

@Composable
fun RegistrySearch(
    results: List<RegistrySearchResult>,
    modifier: Modifier = Modifier,
    query: String = "",
    searching: Boolean = false,
    onSelect: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(if (searching) RegistrySearchState.Searching else RegistrySearchState.Idle) }
    val listState = rememberScalingLazyListState()

    LaunchedEffect(searching) {
        state = if (searching) registrySearchReduce(state, RegistrySearchEvent.Search)
        else registrySearchReduce(state, RegistrySearchEvent.SearchComplete)
    }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Registry search" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    if (query.isNotEmpty()) "\"$query\" (${results.size})" else "Registry",
                    style = MaterialTheme.typography.titleSmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        if (state == RegistrySearchState.Searching) {
            item {
                Text(
                    "Searching...",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        items(results) { result ->
            Chip(
                onClick = { onSelect(result.name) },
                label = {
                    Text(
                        text = "${result.name}@${result.version}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                secondaryLabel = result.description?.let {
                    {
                        Text(
                            text = it,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            )
        }

        if (results.isEmpty() && state != RegistrySearchState.Searching && query.isNotEmpty()) {
            item {
                Text(
                    "No results",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
