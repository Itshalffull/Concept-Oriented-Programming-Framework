package com.clef.surface.widgets.concepts.governancedecision

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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

enum class DeliberationThreadState { Viewing, EntrySelected }

sealed class DeliberationThreadEvent {
    data class SelectEntry(val entryId: String) : DeliberationThreadEvent()
    object Deselect : DeliberationThreadEvent()
}

fun deliberationThreadReduce(
    state: DeliberationThreadState,
    event: DeliberationThreadEvent
): DeliberationThreadState = when (state) {
    DeliberationThreadState.Viewing -> when (event) {
        is DeliberationThreadEvent.SelectEntry -> DeliberationThreadState.EntrySelected
        else -> state
    }
    DeliberationThreadState.EntrySelected -> when (event) {
        is DeliberationThreadEvent.Deselect -> DeliberationThreadState.Viewing
        is DeliberationThreadEvent.SelectEntry -> DeliberationThreadState.EntrySelected
    }
}

// --- Public types ---

enum class ArgumentTag { For, Against, Question, Amendment }

data class DeliberationEntry(
    val id: String,
    val author: String,
    val content: String,
    val tag: ArgumentTag,
    val parentId: String? = null,
    val timestamp: String? = null,
    val depth: Int = 0
)

private val TAG_ICONS = mapOf(
    ArgumentTag.For to "\u2713",
    ArgumentTag.Against to "\u2717",
    ArgumentTag.Question to "?",
    ArgumentTag.Amendment to "\u270E"
)

private val TAG_COLORS = mapOf(
    ArgumentTag.For to Color(0xFF22C55E),
    ArgumentTag.Against to Color(0xFFEF4444),
    ArgumentTag.Question to Color(0xFF3B82F6),
    ArgumentTag.Amendment to Color(0xFFEAB308)
)

@Composable
fun DeliberationThread(
    entries: List<DeliberationEntry>,
    modifier: Modifier = Modifier,
    threadStatus: String = "open",
    onSelectEntry: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(DeliberationThreadState.Viewing) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Deliberation thread" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Thread (${entries.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        item {
            Text(
                threadStatus.replaceFirstChar { it.uppercase() },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        items(entries) { entry ->
            val icon = TAG_ICONS[entry.tag] ?: ""
            val color = TAG_COLORS[entry.tag] ?: Color.Gray
            val isSelected = selectedId == entry.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else entry.id
                    selectedId = nextId
                    state = deliberationThreadReduce(
                        state,
                        if (nextId != null) DeliberationThreadEvent.SelectEntry(nextId)
                        else DeliberationThreadEvent.Deselect
                    )
                    if (nextId != null) onSelectEntry(nextId)
                },
                label = {
                    Text(
                        text = "$icon ${entry.author}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = {
                    Text(
                        text = entry.content,
                        maxLines = if (isSelected) 3 else 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.labelSmall
                    )
                },
                modifier = Modifier.padding(start = (entry.depth * 8).dp)
            )
        }
    }
}
