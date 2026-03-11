package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --- State machine ---

enum class ArtifactPanelState { Open, Copied, Fullscreen, Closed }

sealed class ArtifactPanelEvent {
    object Copy : ArtifactPanelEvent()
    object Fullscreen : ArtifactPanelEvent()
    object Close : ArtifactPanelEvent()
    object VersionChange : ArtifactPanelEvent()
    object CopyTimeout : ArtifactPanelEvent()
    object ExitFullscreen : ArtifactPanelEvent()
    object Reopen : ArtifactPanelEvent()
}

fun artifactPanelReduce(state: ArtifactPanelState, event: ArtifactPanelEvent): ArtifactPanelState = when (state) {
    ArtifactPanelState.Open -> when (event) {
        is ArtifactPanelEvent.Copy -> ArtifactPanelState.Copied
        is ArtifactPanelEvent.Fullscreen -> ArtifactPanelState.Fullscreen
        is ArtifactPanelEvent.Close -> ArtifactPanelState.Closed
        is ArtifactPanelEvent.VersionChange -> ArtifactPanelState.Open
        else -> state
    }
    ArtifactPanelState.Copied -> when (event) {
        is ArtifactPanelEvent.CopyTimeout -> ArtifactPanelState.Open
        else -> state
    }
    ArtifactPanelState.Fullscreen -> when (event) {
        is ArtifactPanelEvent.ExitFullscreen -> ArtifactPanelState.Open
        is ArtifactPanelEvent.Close -> ArtifactPanelState.Closed
        else -> state
    }
    ArtifactPanelState.Closed -> when (event) {
        is ArtifactPanelEvent.Reopen -> ArtifactPanelState.Open
        else -> state
    }
}

// --- Types ---

enum class ArtifactType(val icon: String, val label: String) {
    Code("\uD83D\uDCBB", "Code"),
    Document("\uD83D\uDCC4", "Document"),
    Image("\uD83D\uDDBC", "Image"),
    Html("\uD83C\uDF10", "HTML")
}

// --- Component ---

@Composable
fun ArtifactPanel(
    content: String,
    artifactType: ArtifactType,
    title: String,
    modifier: Modifier = Modifier,
    language: String? = null,
    showVersions: Boolean = true,
    currentVersion: Int = 1,
    totalVersions: Int = 1,
    onVersionChange: (Int) -> Unit = {},
    onClose: () -> Unit = {},
    onCopy: () -> Unit = {},
    onDownload: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ArtifactPanelState.Open) }
    val clipboardManager = LocalClipboardManager.current

    // Copy timeout
    LaunchedEffect(state) {
        if (state == ArtifactPanelState.Copied) {
            delay(2000)
            state = artifactPanelReduce(state, ArtifactPanelEvent.CopyTimeout)
        }
    }

    // Notify parent on close
    LaunchedEffect(state) {
        if (state == ArtifactPanelState.Closed) {
            onClose()
        }
    }

    if (state == ArtifactPanelState.Closed) return

    val showVersionBar = showVersions && totalVersions > 1

    Column(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Artifact panel: $title" }
    ) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            // Type badge
            Text("${artifactType.icon} ${artifactType.label}", fontSize = 12.sp, modifier = Modifier.padding(end = 8.dp))

            // Title
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))

            // Toolbar
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                // Copy
                TextButton(onClick = {
                    clipboardManager.setText(AnnotatedString(content))
                    state = artifactPanelReduce(state, ArtifactPanelEvent.Copy)
                    onCopy()
                }) {
                    Text(if (state == ArtifactPanelState.Copied) "Copied!" else "Copy", fontSize = 12.sp)
                }

                // Download
                TextButton(onClick = { onDownload() }) {
                    Text("Download", fontSize = 12.sp)
                }

                // Fullscreen toggle
                TextButton(onClick = {
                    state = if (state == ArtifactPanelState.Fullscreen)
                        artifactPanelReduce(state, ArtifactPanelEvent.ExitFullscreen)
                    else
                        artifactPanelReduce(state, ArtifactPanelEvent.Fullscreen)
                }) {
                    Text(
                        if (state == ArtifactPanelState.Fullscreen) "Exit Fullscreen" else "Fullscreen",
                        fontSize = 12.sp
                    )
                }

                // Close
                TextButton(onClick = {
                    state = artifactPanelReduce(state, ArtifactPanelEvent.Close)
                }) {
                    Text("Close", fontSize = 12.sp)
                }
            }
        }

        // Version bar
        if (showVersionBar) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
            ) {
                TextButton(
                    onClick = {
                        if (currentVersion > 1) {
                            state = artifactPanelReduce(state, ArtifactPanelEvent.VersionChange)
                            onVersionChange(currentVersion - 1)
                        }
                    },
                    enabled = currentVersion > 1
                ) { Text("\u2039", fontSize = 14.sp) }

                Text("Version $currentVersion of $totalVersions", fontSize = 12.sp)

                TextButton(
                    onClick = {
                        if (currentVersion < totalVersions) {
                            state = artifactPanelReduce(state, ArtifactPanelEvent.VersionChange)
                            onVersionChange(currentVersion + 1)
                        }
                    },
                    enabled = currentVersion < totalVersions
                ) { Text("\u203A", fontSize = 14.sp) }
            }
        }

        HorizontalDivider()

        // Content area
        when (artifactType) {
            ArtifactType.Code -> {
                Column(Modifier.padding(12.dp)) {
                    language?.let {
                        Text(it.uppercase(), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
                    }
                    Text(content, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                }
            }
            ArtifactType.Document -> {
                Text(content, modifier = Modifier.padding(16.dp), fontSize = 14.sp, lineHeight = 22.sp)
            }
            ArtifactType.Image -> {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Text("[Image: $title]", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            ArtifactType.Html -> {
                Column(Modifier.padding(16.dp)) {
                    Text("HTML preview is sandboxed. Raw HTML is not rendered directly.",
                        fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(bottom = 8.dp))
                    Text(content, fontFamily = FontFamily.Monospace, fontSize = 13.sp)
                }
            }
        }
    }
}
