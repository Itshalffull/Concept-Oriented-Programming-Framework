package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class MessageBranchNavState { Viewing, Editing }

sealed class MessageBranchNavEvent {
    object Prev : MessageBranchNavEvent()
    object Next : MessageBranchNavEvent()
    object Edit : MessageBranchNavEvent()
    object Save : MessageBranchNavEvent()
    object Cancel : MessageBranchNavEvent()
}

fun messageBranchNavReduce(state: MessageBranchNavState, event: MessageBranchNavEvent): MessageBranchNavState = when (state) {
    MessageBranchNavState.Viewing -> when (event) {
        is MessageBranchNavEvent.Prev -> MessageBranchNavState.Viewing
        is MessageBranchNavEvent.Next -> MessageBranchNavState.Viewing
        is MessageBranchNavEvent.Edit -> MessageBranchNavState.Editing
        else -> state
    }
    MessageBranchNavState.Editing -> when (event) {
        is MessageBranchNavEvent.Save -> MessageBranchNavState.Viewing
        is MessageBranchNavEvent.Cancel -> MessageBranchNavState.Viewing
        else -> state
    }
}

@Composable
fun MessageBranchNav(
    currentIndex: Int,
    totalBranches: Int,
    modifier: Modifier = Modifier,
    showEdit: Boolean = true,
    onPrevBranch: () -> Unit = {},
    onNextBranch: () -> Unit = {},
    onEdit: () -> Unit = {},
    onSave: () -> Unit = {},
    onCancel: () -> Unit = {}
) {
    var state by remember { mutableStateOf(MessageBranchNavState.Viewing) }

    val isFirst = currentIndex <= 0
    val isLast = currentIndex >= totalBranches - 1
    val displayIndex = currentIndex + 1

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier.semantics { contentDescription = "Branch $displayIndex of $totalBranches" }
    ) {
        // Previous
        IconButton(
            onClick = {
                if (!isFirst) {
                    state = messageBranchNavReduce(state, MessageBranchNavEvent.Prev)
                    onPrevBranch()
                }
            },
            enabled = !isFirst,
            modifier = Modifier.size(32.dp)
        ) { Text("\u25C0", fontSize = 12.sp) }

        // Indicator
        Text("$displayIndex / $totalBranches", fontSize = 13.sp)

        // Next
        IconButton(
            onClick = {
                if (!isLast) {
                    state = messageBranchNavReduce(state, MessageBranchNavEvent.Next)
                    onNextBranch()
                }
            },
            enabled = !isLast,
            modifier = Modifier.size(32.dp)
        ) { Text("\u25B6", fontSize = 12.sp) }

        // Edit / Save+Cancel
        if (state == MessageBranchNavState.Viewing && showEdit) {
            IconButton(
                onClick = {
                    state = messageBranchNavReduce(state, MessageBranchNavEvent.Edit)
                    onEdit()
                },
                modifier = Modifier.size(32.dp)
            ) { Text("\u270E", fontSize = 12.sp) }
        }

        if (state == MessageBranchNavState.Editing) {
            IconButton(
                onClick = {
                    state = messageBranchNavReduce(state, MessageBranchNavEvent.Save)
                    onSave()
                },
                modifier = Modifier.size(32.dp)
            ) { Text("\u2713", fontSize = 12.sp) }

            IconButton(
                onClick = {
                    state = messageBranchNavReduce(state, MessageBranchNavEvent.Cancel)
                    onCancel()
                },
                modifier = Modifier.size(32.dp)
            ) { Text("\u2715", fontSize = 12.sp) }
        }
    }
}
