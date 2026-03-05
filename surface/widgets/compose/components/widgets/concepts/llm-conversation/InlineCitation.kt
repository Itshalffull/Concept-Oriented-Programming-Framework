package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class InlineCitationState { Idle, Previewing, Navigating }

sealed class InlineCitationEvent {
    object Hover : InlineCitationEvent()
    object Click : InlineCitationEvent()
    object Leave : InlineCitationEvent()
    object NavigateComplete : InlineCitationEvent()
}

fun inlineCitationReduce(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState = when (state) {
    InlineCitationState.Idle -> when (event) {
        is InlineCitationEvent.Hover -> InlineCitationState.Previewing
        is InlineCitationEvent.Click -> InlineCitationState.Navigating
        else -> state
    }
    InlineCitationState.Previewing -> when (event) {
        is InlineCitationEvent.Leave -> InlineCitationState.Idle
        is InlineCitationEvent.Click -> InlineCitationState.Navigating
        else -> state
    }
    InlineCitationState.Navigating -> when (event) {
        is InlineCitationEvent.NavigateComplete -> InlineCitationState.Idle
        else -> state
    }
}

@Composable
fun InlineCitation(
    index: Int,
    title: String,
    modifier: Modifier = Modifier,
    url: String? = null,
    excerpt: String? = null,
    showPreviewOnHover: Boolean = true,
    onClick: () -> Unit = {}
) {
    var state by remember { mutableStateOf(InlineCitationState.Idle) }

    // Auto-complete navigation
    LaunchedEffect(state) {
        if (state == InlineCitationState.Navigating) {
            state = inlineCitationReduce(state, InlineCitationEvent.NavigateComplete)
        }
    }

    Box(modifier = modifier) {
        // Badge
        Text(
            "[$index]",
            fontSize = 11.sp,
            color = MaterialTheme.colorScheme.primary,
            textDecoration = TextDecoration.Underline,
            modifier = Modifier
                .clickable {
                    state = inlineCitationReduce(state, InlineCitationEvent.Click)
                    onClick()
                }
                .semantics { contentDescription = "Citation $index: $title" }
        )

        // Tooltip (shown when previewing)
        if (state == InlineCitationState.Previewing && showPreviewOnHover) {
            Surface(
                tonalElevation = 4.dp,
                shape = MaterialTheme.shapes.small,
                modifier = Modifier.padding(top = 20.dp)
            ) {
                Column(Modifier.padding(8.dp).widthIn(min = 120.dp, max = 240.dp)) {
                    Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                    excerpt?.let {
                        Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                    }
                    url?.let {
                        Text(
                            it,
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}
