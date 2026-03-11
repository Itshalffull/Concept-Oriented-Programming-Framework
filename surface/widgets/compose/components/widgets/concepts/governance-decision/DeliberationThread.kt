package com.clef.surface.widgets.concepts.governancedecision

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class DeliberationThreadState { Viewing, Composing, EntrySelected }

sealed class DeliberationThreadEvent {
    data class ReplyTo(val entryId: String) : DeliberationThreadEvent()
    data class SelectEntry(val entryId: String) : DeliberationThreadEvent()
    object Send : DeliberationThreadEvent()
    object Cancel : DeliberationThreadEvent()
    object Deselect : DeliberationThreadEvent()
}

data class DeliberationThreadContext(
    val state: DeliberationThreadState = DeliberationThreadState.Viewing,
    val replyTargetId: String? = null,
    val selectedEntryId: String? = null
)

fun deliberationThreadReduce(
    ctx: DeliberationThreadContext,
    event: DeliberationThreadEvent
): DeliberationThreadContext = when (ctx.state) {
    DeliberationThreadState.Viewing -> when (event) {
        is DeliberationThreadEvent.ReplyTo -> DeliberationThreadContext(DeliberationThreadState.Composing, replyTargetId = event.entryId)
        is DeliberationThreadEvent.SelectEntry -> DeliberationThreadContext(DeliberationThreadState.EntrySelected, selectedEntryId = event.entryId)
        else -> ctx
    }
    DeliberationThreadState.Composing -> when (event) {
        is DeliberationThreadEvent.Send -> DeliberationThreadContext()
        is DeliberationThreadEvent.Cancel -> DeliberationThreadContext()
        else -> ctx
    }
    DeliberationThreadState.EntrySelected -> when (event) {
        is DeliberationThreadEvent.Deselect -> DeliberationThreadContext()
        is DeliberationThreadEvent.ReplyTo -> DeliberationThreadContext(DeliberationThreadState.Composing, replyTargetId = event.entryId)
        else -> ctx
    }
}

// --- Types ---

enum class ArgumentTag(val label: String, val color: Color) {
    For("For", Color(0xFF22C55E)),
    Against("Against", Color(0xFFEF4444)),
    Question("Question", Color(0xFF3B82F6)),
    Amendment("Amendment", Color(0xFFEAB308))
}

enum class SortMode { Time, Tag, Relevance }

data class DeliberationEntry(
    val id: String,
    val author: String,
    val avatar: String? = null,
    val content: String,
    val timestamp: String,
    val tag: ArgumentTag,
    val parentId: String? = null,
    val relevance: Int? = null
)

// --- Helpers ---

private data class EntryNode(
    val entry: DeliberationEntry,
    val children: MutableList<EntryNode> = mutableListOf(),
    var depth: Int = 0
)

private fun buildTree(entries: List<DeliberationEntry>, maxNesting: Int): List<EntryNode> {
    val byId = mutableMapOf<String, EntryNode>()
    val roots = mutableListOf<EntryNode>()
    entries.forEach { byId[it.id] = EntryNode(it) }
    entries.forEach { entry ->
        val node = byId[entry.id]!!
        if (entry.parentId != null && byId.containsKey(entry.parentId)) {
            val parent = byId[entry.parentId]!!
            node.depth = minOf(parent.depth + 1, maxNesting)
            parent.children.add(node)
        } else {
            roots.add(node)
        }
    }
    return roots
}

private fun flattenTree(nodes: List<EntryNode>, collapsedIds: Set<String>): List<EntryNode> {
    val result = mutableListOf<EntryNode>()
    for (node in nodes) {
        result.add(node)
        if (node.entry.id !in collapsedIds && node.children.isNotEmpty()) {
            result.addAll(flattenTree(node.children, collapsedIds))
        }
    }
    return result
}

private fun sortEntries(entries: List<DeliberationEntry>, mode: SortMode): List<DeliberationEntry> = when (mode) {
    SortMode.Time -> entries.sortedBy { it.timestamp }
    SortMode.Tag -> entries.sortedBy { it.tag.ordinal }
    SortMode.Relevance -> entries.sortedByDescending { it.relevance ?: 0 }
}

private fun computeSentiment(entries: List<DeliberationEntry>): Triple<Int, Int, Float> {
    val forCount = entries.count { it.tag == ArgumentTag.For }
    val againstCount = entries.count { it.tag == ArgumentTag.Against }
    val total = forCount + againstCount
    val ratio = if (total > 0) forCount.toFloat() / total else 0.5f
    return Triple(forCount, againstCount, ratio)
}

@Composable
fun DeliberationThread(
    entries: List<DeliberationEntry>,
    status: String,
    modifier: Modifier = Modifier,
    summary: String? = null,
    showSentiment: Boolean = true,
    showTags: Boolean = true,
    maxNesting: Int = 3,
    sortMode: SortMode = SortMode.Time,
    onReply: (String, String) -> Unit = { _, _ -> },
    onSortChange: (SortMode) -> Unit = {},
    onEntrySelect: (String) -> Unit = {}
) {
    var ctx by remember { mutableStateOf(DeliberationThreadContext()) }
    var collapsedIds by remember { mutableStateOf(emptySet<String>()) }
    var internalSortMode by remember { mutableStateOf(sortMode) }
    var composeText by remember { mutableStateOf("") }

    val sorted = remember(entries, internalSortMode) { sortEntries(entries, internalSortMode) }
    val tree = remember(sorted, maxNesting) { buildTree(sorted, maxNesting) }
    val flatNodes = remember(tree, collapsedIds) { flattenTree(tree, collapsedIds) }
    val (forCount, againstCount, sentimentRatio) = remember(entries) { computeSentiment(entries) }

    fun handleSend() {
        val targetId = ctx.replyTargetId
        if (targetId != null && composeText.isNotBlank()) {
            onReply(targetId, composeText.trim())
        }
        composeText = ""
        ctx = deliberationThreadReduce(ctx, DeliberationThreadEvent.Send)
    }

    fun handleCancel() {
        composeText = ""
        ctx = deliberationThreadReduce(ctx, DeliberationThreadEvent.Cancel)
    }

    Column(modifier = modifier.semantics { contentDescription = "Deliberation thread" }) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text(status, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Spacer(Modifier.weight(1f))
        }

        summary?.let {
            Text(it, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp))
        }

        // Sort controls
        Row(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
        ) {
            SortMode.entries.forEach { mode ->
                FilterChip(
                    selected = internalSortMode == mode,
                    onClick = {
                        internalSortMode = mode
                        onSortChange(mode)
                    },
                    label = { Text(mode.name, fontSize = 12.sp) }
                )
            }
        }

        // Sentiment bar
        if (showSentiment) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .padding(horizontal = 12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(sentimentRatio.coerceAtLeast(0.01f))
                        .fillMaxHeight()
                        .background(ArgumentTag.For.color)
                )
                Box(
                    modifier = Modifier
                        .weight((1f - sentimentRatio).coerceAtLeast(0.01f))
                        .fillMaxHeight()
                        .background(ArgumentTag.Against.color)
                )
            }
            Spacer(Modifier.height(8.dp))
        }

        HorizontalDivider()

        // Entry list
        if (flatNodes.isEmpty()) {
            Text(
                "No contributions yet.",
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(12.dp)
            )
        }

        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(flatNodes, key = { _, node -> node.entry.id }) { _, node ->
                val entry = node.entry
                val isSelected = ctx.selectedEntryId == entry.id
                val isReplyTarget = ctx.replyTargetId == entry.id

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = (node.depth * 24).dp, end = 8.dp, top = 4.dp, bottom = 4.dp)
                        .clickable {
                            if (isSelected) {
                                ctx = deliberationThreadReduce(ctx, DeliberationThreadEvent.Deselect)
                            } else {
                                ctx = deliberationThreadReduce(ctx, DeliberationThreadEvent.SelectEntry(entry.id))
                                onEntrySelect(entry.id)
                            }
                        }
                        .then(
                            if (isSelected) Modifier.background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f))
                            else Modifier
                        )
                ) {
                    // Author row
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Avatar
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        ) {
                            Text(entry.author.first().uppercase(), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Text(entry.author, fontWeight = FontWeight.Medium, fontSize = 14.sp)

                        // Tag badge
                        if (showTags) {
                            Surface(
                                color = entry.tag.color,
                                shape = MaterialTheme.shapes.small
                            ) {
                                Text(
                                    entry.tag.label,
                                    color = Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                                )
                            }
                        }

                        Spacer(Modifier.weight(1f))
                        Text(entry.timestamp, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    // Content
                    Text(entry.content, fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp))

                    // Reply button
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                        TextButton(
                            onClick = { ctx = deliberationThreadReduce(ctx, DeliberationThreadEvent.ReplyTo(entry.id)) },
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                        ) { Text("Reply", fontSize = 12.sp) }

                        if (node.children.isNotEmpty()) {
                            val isCollapsed = entry.id in collapsedIds
                            TextButton(
                                onClick = {
                                    collapsedIds = if (isCollapsed) collapsedIds - entry.id else collapsedIds + entry.id
                                },
                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp)
                            ) {
                                Text(
                                    if (isCollapsed) "Show replies (${node.children.size})" else "Hide replies",
                                    fontSize = 12.sp
                                )
                            }
                        }
                    }

                    // Compose box
                    if (ctx.state == DeliberationThreadState.Composing && isReplyTarget) {
                        Column(modifier = Modifier.padding(start = 24.dp, top = 8.dp)) {
                            OutlinedTextField(
                                value = composeText,
                                onValueChange = { composeText = it },
                                label = { Text("Add your contribution...") },
                                modifier = Modifier.fillMaxWidth(),
                                minLines = 3
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                                Button(onClick = { handleSend() }) { Text("Send") }
                                OutlinedButton(onClick = { handleCancel() }) { Text("Cancel") }
                            }
                        }
                    }
                }
            }
        }
    }
}
