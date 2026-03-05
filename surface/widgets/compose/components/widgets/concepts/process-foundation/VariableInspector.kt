package com.clef.surface.widgets.concepts.processfoundation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class VariableInspectorState { Idle, Filtering, VarSelected }

sealed class VariableInspectorEvent {
    data class Search(val query: String) : VariableInspectorEvent()
    data class SelectVar(val name: String) : VariableInspectorEvent()
    data class AddWatch(val name: String) : VariableInspectorEvent()
    object Clear : VariableInspectorEvent()
    object Deselect : VariableInspectorEvent()
}

fun variableInspectorReduce(state: VariableInspectorState, event: VariableInspectorEvent): VariableInspectorState = when (state) {
    VariableInspectorState.Idle -> when (event) {
        is VariableInspectorEvent.Search -> VariableInspectorState.Filtering
        is VariableInspectorEvent.SelectVar -> VariableInspectorState.VarSelected
        is VariableInspectorEvent.AddWatch -> VariableInspectorState.Idle
        else -> state
    }
    VariableInspectorState.Filtering -> when (event) {
        is VariableInspectorEvent.Clear -> VariableInspectorState.Idle
        is VariableInspectorEvent.SelectVar -> VariableInspectorState.VarSelected
        else -> state
    }
    VariableInspectorState.VarSelected -> when (event) {
        is VariableInspectorEvent.Deselect -> VariableInspectorState.Idle
        is VariableInspectorEvent.SelectVar -> VariableInspectorState.VarSelected
        else -> state
    }
}

// --- Types ---

data class ProcessVariable(
    val name: String,
    val type: String,
    val value: String,
    val scope: String? = null,
    val changed: Boolean = false
)

data class WatchExpression(
    val id: String,
    val expression: String,
    val value: String? = null
)

// --- Helpers ---

private fun typeBadge(type: String): String = when (type.lowercase()) {
    "string" -> "str"
    "number" -> "num"
    "boolean" -> "bool"
    "object" -> "obj"
    "array" -> "arr"
    else -> type
}

@Composable
fun VariableInspector(
    variables: List<ProcessVariable>,
    runStatus: String,
    modifier: Modifier = Modifier,
    showTypes: Boolean = true,
    showWatch: Boolean = true,
    watchExpressions: List<WatchExpression> = emptyList(),
    onSelectVariable: (String) -> Unit = {},
    onAddWatch: (String) -> Unit = {},
    onRemoveWatch: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(VariableInspectorState.Idle) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedVar by remember { mutableStateOf<String?>(null) }

    val filteredVariables = remember(variables, searchQuery) {
        if (searchQuery.isBlank()) variables
        else variables.filter { it.name.contains(searchQuery, ignoreCase = true) }
    }

    Column(modifier = modifier.semantics { contentDescription = "Variable inspector" }) {
        // Search bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = {
                searchQuery = it
                state = if (it.isNotBlank()) variableInspectorReduce(state, VariableInspectorEvent.Search(it))
                else variableInspectorReduce(state, VariableInspectorEvent.Clear)
            },
            placeholder = { Text("Filter variables\u2026") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = {
                        searchQuery = ""
                        state = variableInspectorReduce(state, VariableInspectorEvent.Clear)
                    }) { Text("\u2715", fontSize = 14.sp) }
                }
            }
        )

        // Variable list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(filteredVariables) { _, variable ->
                val isSelected = selectedVar == variable.name
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            selectedVar = variable.name
                            state = variableInspectorReduce(state, VariableInspectorEvent.SelectVar(variable.name))
                            onSelectVariable(variable.name)
                        }
                        .padding(vertical = 6.dp, horizontal = 4.dp)
                ) {
                    // Name
                    Text(
                        variable.name,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        fontSize = 13.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.weight(0.3f)
                    )

                    // Type badge
                    if (showTypes) {
                        Surface(tonalElevation = 2.dp, shape = MaterialTheme.shapes.small) {
                            Text(
                                typeBadge(variable.type),
                                fontSize = 10.sp,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
                            )
                        }
                        Spacer(Modifier.width(6.dp))
                    }

                    // Scope
                    if (variable.scope != null) {
                        Text(variable.scope, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.width(6.dp))
                    }

                    // Value
                    Text(
                        variable.value,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(0.5f),
                        maxLines = 1
                    )

                    // Changed indicator
                    if (variable.changed) {
                        Text("\u2022", fontSize = 14.sp, color = MaterialTheme.colorScheme.primary)
                    }
                }
                HorizontalDivider()
            }

            if (filteredVariables.isEmpty()) {
                item {
                    Text(
                        if (searchQuery.isNotEmpty()) "No variables match the filter" else "No variables available",
                        modifier = Modifier.padding(12.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Watch list
        if (showWatch) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text("Watch Expressions", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                TextButton(onClick = {
                    val expr = selectedVar ?: ""
                    if (expr.isNotEmpty()) {
                        state = variableInspectorReduce(state, VariableInspectorEvent.AddWatch(expr))
                        onAddWatch(expr)
                    }
                }) {
                    Text("+ Watch", fontSize = 12.sp)
                }
            }

            watchExpressions.forEach { watch ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
                ) {
                    Text(watch.expression, fontFamily = FontFamily.Monospace, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    Text(
                        watch.value ?: "evaluating\u2026",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f)
                    )
                    IconButton(onClick = { onRemoveWatch(watch.id) }, modifier = Modifier.size(24.dp)) {
                        Text("\u2715", fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
