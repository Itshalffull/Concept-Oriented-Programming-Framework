package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class MessageBranchNavState { Viewing, Editing }

sealed class MessageBranchNavEvent {
    object Next : MessageBranchNavEvent()
    object Previous : MessageBranchNavEvent()
    object Edit : MessageBranchNavEvent()
    object CancelEdit : MessageBranchNavEvent()
}

fun messageBranchNavReduce(
    state: MessageBranchNavState,
    event: MessageBranchNavEvent
): MessageBranchNavState = when (state) {
    MessageBranchNavState.Viewing -> when (event) {
        is MessageBranchNavEvent.Edit -> MessageBranchNavState.Editing
        else -> state
    }
    MessageBranchNavState.Editing -> when (event) {
        is MessageBranchNavEvent.CancelEdit -> MessageBranchNavState.Viewing
        else -> state
    }
}

@Composable
fun MessageBranchNav(
    currentIndex: Int,
    totalBranches: Int,
    modifier: Modifier = Modifier,
    showEdit: Boolean = false,
    onPrevious: () -> Unit = {},
    onNext: () -> Unit = {},
    onEdit: () -> Unit = {}
) {
    var state by remember { mutableStateOf(MessageBranchNavState.Viewing) }
    val listState = rememberScalingLazyListState()

    val atFirst = currentIndex <= 0
    val atLast = currentIndex >= totalBranches - 1

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Branch ${currentIndex + 1} of $totalBranches" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            Text(
                text = "${currentIndex + 1} / $totalBranches",
                style = MaterialTheme.typography.titleSmall
            )
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        if (!atFirst) onPrevious()
                    },
                    label = { Text("\u25C0") }
                )
                Button(
                    onClick = {
                        if (!atLast) onNext()
                    },
                    label = { Text("\u25B6") }
                )
            }
        }

        if (showEdit) {
            item {
                Button(
                    onClick = {
                        state = messageBranchNavReduce(state, MessageBranchNavEvent.Edit)
                        onEdit()
                    },
                    label = { Text("\u270E Edit") }
                )
            }
        }
    }
}
