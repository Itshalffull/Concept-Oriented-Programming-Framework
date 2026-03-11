package com.clef.surface.widgets.concepts.processfoundation

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
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class VariableInspectorState { Idle, VarSelected }

sealed class VariableInspectorEvent {
    data class SelectVar(val name: String) : VariableInspectorEvent()
    object Deselect : VariableInspectorEvent()
}

fun variableInspectorReduce(
    state: VariableInspectorState,
    event: VariableInspectorEvent
): VariableInspectorState = when (state) {
    VariableInspectorState.Idle -> when (event) {
        is VariableInspectorEvent.SelectVar -> VariableInspectorState.VarSelected
        else -> state
    }
    VariableInspectorState.VarSelected -> when (event) {
        is VariableInspectorEvent.Deselect -> VariableInspectorState.Idle
        is VariableInspectorEvent.SelectVar -> VariableInspectorState.VarSelected
    }
}

// --- Public types ---

data class ProcessVariable(
    val name: String,
    val value: String,
    val type: String,
    val scope: String? = null,
    val lastModified: String? = null
)

@Composable
fun VariableInspector(
    variables: List<ProcessVariable>,
    modifier: Modifier = Modifier,
    onSelectVar: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(VariableInspectorState.Idle) }
    var selectedName by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Variable inspector" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "Variables (${variables.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(variables) { variable ->
            val isSelected = selectedName == variable.name

            Chip(
                onClick = {
                    val next = if (isSelected) null else variable.name
                    selectedName = next
                    state = variableInspectorReduce(
                        state,
                        if (next != null) VariableInspectorEvent.SelectVar(next)
                        else VariableInspectorEvent.Deselect
                    )
                    if (next != null) onSelectVar(next)
                },
                label = {
                    Text(
                        text = variable.name,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontFamily = FontFamily.Monospace,
                        fontSize = 11.sp
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text(
                                "= ${variable.value}",
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text("Type: ${variable.type}", style = MaterialTheme.typography.labelSmall)
                            variable.scope?.let { Text("Scope: $it", style = MaterialTheme.typography.labelSmall) }
                        }
                    }
                } else {
                    {
                        Text(
                            "= ${variable.value}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 10.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            )
        }
    }
}
