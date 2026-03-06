package com.clef.surface.widgets.concepts.processautomation

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
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class ExpressionToggleInputState { Fixed, Expression }

sealed class ExpressionToggleInputEvent {
    object ToggleMode : ExpressionToggleInputEvent()
}

fun expressionToggleInputReduce(
    state: ExpressionToggleInputState,
    event: ExpressionToggleInputEvent
): ExpressionToggleInputState = when (state) {
    ExpressionToggleInputState.Fixed -> when (event) {
        is ExpressionToggleInputEvent.ToggleMode -> ExpressionToggleInputState.Expression
    }
    ExpressionToggleInputState.Expression -> when (event) {
        is ExpressionToggleInputEvent.ToggleMode -> ExpressionToggleInputState.Fixed
    }
}

@Composable
fun ExpressionToggleInput(
    value: String,
    expression: String,
    modifier: Modifier = Modifier,
    label: String = "Value",
    isExpression: Boolean = false,
    onChange: (String) -> Unit = {}
) {
    var state by remember {
        mutableStateOf(
            if (isExpression) ExpressionToggleInputState.Expression
            else ExpressionToggleInputState.Fixed
        )
    }
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Expression toggle: $label" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(label, style = MaterialTheme.typography.titleSmall)
            }
        }

        // Mode toggle
        item {
            Chip(
                onClick = {
                    state = expressionToggleInputReduce(state, ExpressionToggleInputEvent.ToggleMode)
                },
                label = {
                    val modeIcon = if (state == ExpressionToggleInputState.Expression) "fx" else "123"
                    val modeLabel = if (state == ExpressionToggleInputState.Expression) "Expression" else "Fixed"
                    Text("$modeIcon $modeLabel")
                }
            )
        }

        // Display current value (read-only on watch)
        item {
            Card(onClick = {}) {
                Column(modifier = Modifier.padding(8.dp)) {
                    if (state == ExpressionToggleInputState.Expression) {
                        Text(
                            "Expression",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = expression,
                            fontSize = 11.sp,
                            fontFamily = FontFamily.Monospace,
                            maxLines = 4,
                            overflow = TextOverflow.Ellipsis
                        )
                    } else {
                        Text(
                            "Value",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = value,
                            style = MaterialTheme.typography.bodySmall,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}
