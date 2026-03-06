package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ArtifactPanelState { Open, Copied, Closed }

sealed class ArtifactPanelEvent {
    object Copy : ArtifactPanelEvent()
    object CopyTimeout : ArtifactPanelEvent()
    object Close : ArtifactPanelEvent()
    object Reopen : ArtifactPanelEvent()
}

fun artifactPanelReduce(
    state: ArtifactPanelState,
    event: ArtifactPanelEvent
): ArtifactPanelState = when (state) {
    ArtifactPanelState.Open -> when (event) {
        is ArtifactPanelEvent.Copy -> ArtifactPanelState.Copied
        is ArtifactPanelEvent.Close -> ArtifactPanelState.Closed
        else -> state
    }
    ArtifactPanelState.Copied -> when (event) {
        is ArtifactPanelEvent.CopyTimeout -> ArtifactPanelState.Open
        else -> state
    }
    ArtifactPanelState.Closed -> when (event) {
        is ArtifactPanelEvent.Reopen -> ArtifactPanelState.Open
        else -> state
    }
}

// --- Public types ---

private val TYPE_ICONS = mapOf(
    "code" to "\uD83D\uDCBB",
    "document" to "\uD83D\uDCC4",
    "image" to "\uD83D\uDDBC",
    "html" to "\uD83C\uDF10"
)

@Composable
fun ArtifactPanel(
    content: String,
    artifactType: String,
    title: String,
    modifier: Modifier = Modifier,
    language: String? = null,
    versionCount: Int = 1,
    currentVersion: Int = 1,
    onClose: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ArtifactPanelState.Open) }
    val listState = rememberScalingLazyListState()

    val typeIcon = TYPE_ICONS[artifactType] ?: "\uD83D\uDCC4"

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Artifact: $title" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$typeIcon $title",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (versionCount > 1) {
            item {
                Text(
                    "v$currentVersion/$versionCount",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        language?.let {
            item {
                Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        item {
            Card(onClick = {}) {
                Text(
                    text = content,
                    fontSize = 10.sp,
                    fontFamily = if (artifactType == "code") FontFamily.Monospace else FontFamily.Default,
                    maxLines = 20,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(8.dp)
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        state = artifactPanelReduce(state, ArtifactPanelEvent.Copy)
                    },
                    label = {
                        Text(if (state == ArtifactPanelState.Copied) "\u2713" else "Copy")
                    }
                )
                Button(
                    onClick = {
                        state = artifactPanelReduce(state, ArtifactPanelEvent.Close)
                        onClose()
                    },
                    label = { Text("Close") }
                )
            }
        }
    }

    // Auto-reset copied state
    if (state == ArtifactPanelState.Copied) {
        LaunchedEffect(Unit) {
            kotlinx.coroutines.delay(2000)
            state = artifactPanelReduce(state, ArtifactPanelEvent.CopyTimeout)
        }
    }
}
