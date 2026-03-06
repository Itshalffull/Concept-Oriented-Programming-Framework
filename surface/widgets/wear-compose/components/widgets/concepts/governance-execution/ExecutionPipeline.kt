package com.clef.surface.widgets.concepts.governanceexecution

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

enum class ExecutionPipelineState { Idle, StageSelected, Failed }

sealed class ExecutionPipelineEvent {
    data class SelectStage(val stageId: String) : ExecutionPipelineEvent()
    object Deselect : ExecutionPipelineEvent()
    object Fail : ExecutionPipelineEvent()
}

fun executionPipelineReduce(
    state: ExecutionPipelineState,
    event: ExecutionPipelineEvent
): ExecutionPipelineState = when (state) {
    ExecutionPipelineState.Idle -> when (event) {
        is ExecutionPipelineEvent.SelectStage -> ExecutionPipelineState.StageSelected
        is ExecutionPipelineEvent.Fail -> ExecutionPipelineState.Failed
        else -> state
    }
    ExecutionPipelineState.StageSelected -> when (event) {
        is ExecutionPipelineEvent.Deselect -> ExecutionPipelineState.Idle
        is ExecutionPipelineEvent.SelectStage -> ExecutionPipelineState.StageSelected
        else -> state
    }
    ExecutionPipelineState.Failed -> state
}

// --- Public types ---

enum class PipelineStageStatus { Pending, Active, Complete, Failed, Skipped }

data class PipelineStage(
    val id: String,
    val name: String,
    val status: PipelineStageStatus,
    val description: String? = null
)

private val STATUS_ICONS = mapOf(
    PipelineStageStatus.Pending to "\u25CB",
    PipelineStageStatus.Active to "\u25B6",
    PipelineStageStatus.Complete to "\u2713",
    PipelineStageStatus.Failed to "\u2717",
    PipelineStageStatus.Skipped to "\u2298"
)

private val STATUS_COLORS = mapOf(
    PipelineStageStatus.Pending to Color(0xFF9CA3AF),
    PipelineStageStatus.Active to Color(0xFF3B82F6),
    PipelineStageStatus.Complete to Color(0xFF22C55E),
    PipelineStageStatus.Failed to Color(0xFFEF4444),
    PipelineStageStatus.Skipped to Color(0xFF6B7280)
)

@Composable
fun ExecutionPipeline(
    stages: List<PipelineStage>,
    modifier: Modifier = Modifier,
    pipelineStatus: String = "",
    onStageSelect: (PipelineStage) -> Unit = {}
) {
    var state by remember { mutableStateOf(ExecutionPipelineState.Idle) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val completed = stages.count { it.status == PipelineStageStatus.Complete }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Execution pipeline" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Pipeline $completed/${stages.size}",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        if (pipelineStatus.isNotBlank()) {
            item {
                Text(
                    pipelineStatus,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        items(stages) { stage ->
            val icon = STATUS_ICONS[stage.status] ?: "\u25CB"
            val color = STATUS_COLORS[stage.status] ?: Color.Gray
            val isSelected = selectedId == stage.id

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else stage.id
                    selectedId = nextId
                    state = executionPipelineReduce(
                        state,
                        if (nextId != null) ExecutionPipelineEvent.SelectStage(nextId)
                        else ExecutionPipelineEvent.Deselect
                    )
                    onStageSelect(stage)
                },
                label = {
                    Text(
                        text = "$icon ${stage.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = color
                    )
                },
                secondaryLabel = if (isSelected && stage.description != null) {
                    { Text(stage.description, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall) }
                } else null
            )
        }
    }
}
