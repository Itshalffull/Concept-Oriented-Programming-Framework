package com.clef.surface.widgets.concepts.processautomation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --- State machine ---

enum class ExpressionToggleInputState { Fixed, Expression, Autocompleting }

sealed class ExpressionToggleInputEvent {
    object Toggle : ExpressionToggleInputEvent()
    object Input : ExpressionToggleInputEvent()
    object ShowAc : ExpressionToggleInputEvent()
    data class Select(val variable: String) : ExpressionToggleInputEvent()
    object Dismiss : ExpressionToggleInputEvent()
}

fun expressionToggleInputReduce(state: ExpressionToggleInputState, event: ExpressionToggleInputEvent): ExpressionToggleInputState = when (state) {
    ExpressionToggleInputState.Fixed -> when (event) {
        is ExpressionToggleInputEvent.Toggle -> ExpressionToggleInputState.Expression
        is ExpressionToggleInputEvent.Input -> ExpressionToggleInputState.Fixed
        else -> state
    }
    ExpressionToggleInputState.Expression -> when (event) {
        is ExpressionToggleInputEvent.Toggle -> ExpressionToggleInputState.Fixed
        is ExpressionToggleInputEvent.Input -> ExpressionToggleInputState.Expression
        is ExpressionToggleInputEvent.ShowAc -> ExpressionToggleInputState.Autocompleting
        else -> state
    }
    ExpressionToggleInputState.Autocompleting -> when (event) {
        is ExpressionToggleInputEvent.Select -> ExpressionToggleInputState.Expression
        is ExpressionToggleInputEvent.Dismiss -> ExpressionToggleInputState.Expression
        else -> state
    }
}

@Composable
fun ExpressionToggleInput(
    value: String,
    modifier: Modifier = Modifier,
    fieldType: String = "text",
    variables: List<String> = emptyList(),
    expression: String = "",
    previewValue: String? = null,
    expressionValid: Boolean? = null,
    onChange: (String) -> Unit = {},
    onExpressionChange: (String) -> Unit = {},
    onToggleMode: (String) -> Unit = {}
) {
    var state by remember { mutableStateOf(ExpressionToggleInputState.Fixed) }
    var fixedValue by remember { mutableStateOf(value) }
    var expressionValue by remember { mutableStateOf(expression) }
    var acQuery by remember { mutableStateOf("") }
    var acIndex by remember { mutableIntStateOf(0) }
    val expressionFocus = remember { FocusRequester() }

    // Sync props
    LaunchedEffect(value) { fixedValue = value }
    LaunchedEffect(expression) { expressionValue = expression }

    // Focus expression when switching
    LaunchedEffect(state) {
        if (state == ExpressionToggleInputState.Expression || state == ExpressionToggleInputState.Autocompleting) {
            expressionFocus.requestFocus()
        }
    }

    val isExpressionMode = state != ExpressionToggleInputState.Fixed

    val suggestions = remember(variables, acQuery) {
        if (acQuery.isEmpty()) variables
        else variables.filter { it.contains(acQuery, ignoreCase = true) }
    }

    Column(modifier = modifier.semantics { contentDescription = "Expression toggle input" }) {
        // Mode toggle
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 4.dp)
        ) {
            Switch(
                checked = isExpressionMode,
                onCheckedChange = {
                    val newMode = if (state == ExpressionToggleInputState.Fixed) "expression" else "fixed"
                    state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Toggle)
                    onToggleMode(newMode)
                },
                modifier = Modifier.semantics { contentDescription = "Expression mode" }
            )
            Text(if (isExpressionMode) "Expression" else "Fixed", fontSize = 13.sp)
        }

        // Fixed value input
        if (!isExpressionMode) {
            when (fieldType) {
                "boolean" -> {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = fixedValue == "true",
                            onCheckedChange = {
                                fixedValue = it.toString()
                                state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Input)
                                onChange(fixedValue)
                            }
                        )
                        Text(fixedValue, fontSize = 13.sp)
                    }
                }
                "number" -> {
                    OutlinedTextField(
                        value = fixedValue,
                        onValueChange = {
                            fixedValue = it
                            state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Input)
                            onChange(it)
                        },
                        label = { Text("Number value") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                else -> {
                    OutlinedTextField(
                        value = fixedValue,
                        onValueChange = {
                            fixedValue = it
                            state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Input)
                            onChange(it)
                        },
                        label = { Text("Text value") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }

        // Expression editor
        if (isExpressionMode) {
            OutlinedTextField(
                value = expressionValue,
                onValueChange = { newExpr ->
                    expressionValue = newExpr
                    state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Input)
                    onExpressionChange(newExpr)

                    // Detect autocomplete trigger
                    val lastWord = newExpr.split(Regex("[\\s()+\\-*/,]+")).lastOrNull() ?: ""
                    if (lastWord.isNotEmpty() && variables.any { it.lowercase().startsWith(lastWord.lowercase()) }) {
                        acQuery = lastWord
                        acIndex = 0
                        state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.ShowAc)
                    }
                },
                label = { Text("Expression") },
                modifier = Modifier.fillMaxWidth().focusRequester(expressionFocus),
                textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp),
                minLines = 2
            )

            // Autocomplete dropdown
            if (state == ExpressionToggleInputState.Autocompleting && suggestions.isNotEmpty()) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column {
                        suggestions.forEachIndexed { index, variable ->
                            Text(
                                variable,
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace,
                                color = if (index == acIndex) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        // Replace last partial word
                                        val parts = expressionValue.split(Regex("[\\s()+\\-*/,]+"))
                                        val lastPart = parts.lastOrNull() ?: ""
                                        expressionValue = expressionValue.dropLast(lastPart.length) + variable
                                        onExpressionChange(expressionValue)
                                        state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.Select(variable))
                                    }
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }

            // Live preview
            if (previewValue != null) {
                Text(
                    previewValue,
                    fontSize = 12.sp,
                    color = if (expressionValid != false) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
    }
}
