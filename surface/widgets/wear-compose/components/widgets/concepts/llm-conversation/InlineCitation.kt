package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class InlineCitationState { Idle, Previewing }

sealed class InlineCitationEvent {
    object Tap : InlineCitationEvent()
    object Dismiss : InlineCitationEvent()
}

fun inlineCitationReduce(
    state: InlineCitationState,
    event: InlineCitationEvent
): InlineCitationState = when (state) {
    InlineCitationState.Idle -> when (event) {
        is InlineCitationEvent.Tap -> InlineCitationState.Previewing
        else -> state
    }
    InlineCitationState.Previewing -> when (event) {
        is InlineCitationEvent.Dismiss -> InlineCitationState.Idle
        is InlineCitationEvent.Tap -> InlineCitationState.Idle
    }
}

@Composable
fun InlineCitation(
    index: Int,
    title: String,
    modifier: Modifier = Modifier,
    url: String? = null,
    snippet: String? = null,
    onNavigate: () -> Unit = {}
) {
    var state by remember { mutableStateOf(InlineCitationState.Idle) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Citation [$index]: $title" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Chip(
                onClick = {
                    state = inlineCitationReduce(state, InlineCitationEvent.Tap)
                },
                label = {
                    Text(
                        text = "[$index] $title",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            )
        }

        if (state == InlineCitationState.Previewing) {
            item {
                Card(onClick = { onNavigate() }) {
                    Column(modifier = Modifier.padding(8.dp)) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.titleSmall,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                        url?.let {
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = it,
                                style = MaterialTheme.typography.labelSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                color = MaterialTheme.colorScheme.primary
                            )
                        }
                        snippet?.let {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = it,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 4,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}
