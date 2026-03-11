package com.clef.surface.widgets.concepts.governanceexecution

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class ExecutionPipelineState { Idle, StageSelected, Failed }

sealed class ExecutionPipelineEvent {
    object Advance : ExecutionPipelineEvent()
    data class SelectStage(val stageId: String?) : ExecutionPipelineEvent()
    object Fail : ExecutionPipelineEvent()
    object Deselect : ExecutionPipelineEvent()
    object Retry : ExecutionPipelineEvent()
    object Reset : ExecutionPipelineEvent()
}

fun executionPipelineReduce(state: ExecutionPipelineState, event: ExecutionPipelineEvent): ExecutionPipelineState = when (state) {
    ExecutionPipelineState.Idle -> when (event) {
        is ExecutionPipelineEvent.Advance -> ExecutionPipelineState.Idle
        is ExecutionPipelineEvent.SelectStage -> ExecutionPipelineState.StageSelected
        is ExecutionPipelineEvent.Fail -> ExecutionPipelineState.Failed
        else -> state
    }
    ExecutionPipelineState.StageSelected -> when (event) {
        is ExecutionPipelineEvent.Deselect -> ExecutionPipelineState.Idle
        else -> state
    }
    ExecutionPipelineState.Failed -> when (event) {
        is ExecutionPipelineEvent.Retry -> ExecutionPipelineState.Idle
        is ExecutionPipelineEvent.Reset -> ExecutionPipelineState.Idle
        else -> state
    }
}

// --- Types ---

enum class PipelineStageStatus(val icon: String, val label: String) {
    Pending("\u25CB", "Pending"),
    Active("\u25CF", "Active"),
    Complete("\u2713", "Complete"),
    Failed("\u2717", "Failed"),
    Skipped("\u2298", "Skipped")
}

data class PipelineStage(
    val id: String,
    val name: String,
    val status: PipelineStageStatus,
    val description: String? = null,
    val isTimelock: Boolean = false
)

@Composable
fun ExecutionPipeline(
    stages: List<PipelineStage>,
    modifier: Modifier = Modifier,
    selectedStageId: String? = null,
    onSelectStage: (String?) -> Unit = {},
    onRetry: () -> Unit = {},
    onReset: () -> Unit = {}
) {
    var state by remember { mutableStateOf(ExecutionPipelineState.Idle) }
    var internalSelectedId by remember { mutableStateOf<String?>(null) }
    val currentSelectedId = selectedStageId ?: internalSelectedId
    val selectedStage = remember(currentSelectedId, stages) { stages.find { it.id == currentSelectedId } }
    val hasFailed = stages.any { it.status == PipelineStageStatus.Failed }

    // Detect failure
    LaunchedEffect(hasFailed) {
        if (hasFailed && state != ExecutionPipelineState.Failed) {
            state = executionPipelineReduce(state, ExecutionPipelineEvent.Fail)
        }
    }

    fun handleSelect(stageId: String) {
        val nextId = if (stageId == currentSelectedId) null else stageId
        internalSelectedId = nextId
        onSelectStage(nextId)
        state = if (nextId != null) {
            executionPipelineReduce(state, ExecutionPipelineEvent.SelectStage(nextId))
        } else {
            executionPipelineReduce(state, ExecutionPipelineEvent.Deselect)
        }
    }

    Column(modifier = modifier.semantics { contentDescription = "Execution pipeline" }) {
        // Failure banner
        if (hasFailed) {
            Surface(
                color = MaterialTheme.colorScheme.errorContainer,
                modifier = Modifier.fillMaxWidth().padding(8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(12.dp)
                ) {
                    Text(
                        "Pipeline execution failed",
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.weight(1f))
                    Button(onClick = {
                        state = executionPipelineReduce(state, ExecutionPipelineEvent.Retry)
                        onRetry()
                    }) { Text("Retry") }
                    OutlinedButton(onClick = {
                        state = executionPipelineReduce(state, ExecutionPipelineEvent.Reset)
                        onReset()
                    }) { Text("Reset") }
                }
            }
        }

        // Pipeline stages
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 8.dp, vertical = 12.dp)
        ) {
            stages.forEachIndexed { index, stage ->
                val isSelected = stage.id == currentSelectedId
                val stageColor = when (stage.status) {
                    PipelineStageStatus.Complete -> MaterialTheme.colorScheme.primary
                    PipelineStageStatus.Active -> MaterialTheme.colorScheme.tertiary
                    PipelineStageStatus.Failed -> MaterialTheme.colorScheme.error
                    PipelineStageStatus.Skipped -> MaterialTheme.colorScheme.onSurfaceVariant
                    PipelineStageStatus.Pending -> MaterialTheme.colorScheme.outline
                }

                // Stage node
                OutlinedCard(
                    modifier = Modifier
                        .clickable { handleSelect(stage.id) }
                        .then(
                            if (isSelected) Modifier.border(2.dp, MaterialTheme.colorScheme.primary, MaterialTheme.shapes.small)
                            else Modifier
                        )
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier.padding(12.dp).widthIn(min = 80.dp)
                    ) {
                        Text(stage.status.icon, fontSize = 20.sp, color = stageColor)
                        Spacer(Modifier.height(4.dp))
                        Text(
                            stage.name,
                            fontSize = 12.sp,
                            fontWeight = if (stage.status == PipelineStageStatus.Active) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                }

                // Connector between stages
                if (index < stages.size - 1) {
                    Box(
                        modifier = Modifier
                            .width(24.dp)
                            .height(2.dp)
                            .background(
                                if (stage.status == PipelineStageStatus.Complete) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.outline
                            )
                    )
                }
            }
        }

        // Detail panel
        selectedStage?.let { stage ->
            HorizontalDivider()
            Column(Modifier.padding(12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("${stage.status.icon} ${stage.name}", fontWeight = FontWeight.Bold)
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = {
                        internalSelectedId = null
                        onSelectStage(null)
                        state = executionPipelineReduce(state, ExecutionPipelineEvent.Deselect)
                    }) { Text("\u2715") }
                }
                Text("Status: ${stage.status.label}", fontSize = 13.sp)
                stage.description?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}
