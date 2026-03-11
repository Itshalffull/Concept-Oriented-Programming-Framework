package com.clef.surface.widgets.concepts.formalverification

import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Chip
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.Text

// --- State machine ---

enum class FormulaDisplayState { Idle, Copied, Rendering }

sealed class FormulaDisplayEvent {
    object Copy : FormulaDisplayEvent()
    object RenderLatex : FormulaDisplayEvent()
    object Timeout : FormulaDisplayEvent()
    object RenderComplete : FormulaDisplayEvent()
}

fun formulaDisplayReduce(
    state: FormulaDisplayState,
    event: FormulaDisplayEvent
): FormulaDisplayState = when (state) {
    FormulaDisplayState.Idle -> when (event) {
        is FormulaDisplayEvent.Copy -> FormulaDisplayState.Copied
        is FormulaDisplayEvent.RenderLatex -> FormulaDisplayState.Rendering
        else -> state
    }
    FormulaDisplayState.Copied -> when (event) {
        is FormulaDisplayEvent.Timeout -> FormulaDisplayState.Idle
        else -> state
    }
    FormulaDisplayState.Rendering -> when (event) {
        is FormulaDisplayEvent.RenderComplete -> FormulaDisplayState.Idle
        else -> state
    }
}

// --- Types ---

private val LANGUAGE_LABELS = mapOf(
    "smtlib" to "SMT-LIB", "tlaplus" to "TLA+", "alloy" to "Alloy",
    "lean" to "Lean", "dafny" to "Dafny", "cvl" to "CVL"
)

@Composable
fun FormulaDisplay(
    formula: String,
    language: String = "smtlib",
    modifier: Modifier = Modifier,
    name: String? = null,
    scope: String? = null,
    description: String? = null,
    onCopy: () -> Unit = {}
) {
    var state by remember { mutableStateOf(FormulaDisplayState.Idle) }
    var expanded by remember { mutableStateOf(false) }
    val isLong = formula.length > 120
    val displayText = if (isLong && !expanded) formula.take(120) + "\u2026" else formula
    val langLabel = LANGUAGE_LABELS[language] ?: language
    val listState = rememberScalingLazyListState()

    ScalingLazyColumn(modifier = modifier.fillMaxSize(), state = listState) {
        item {
            ListHeader { Text(name ?: "Formula", style = MaterialTheme.typography.titleSmall) }
        }
        item {
            Chip(
                onClick = {},
                label = { Text(langLabel, fontSize = 11.sp) },
                secondaryLabel = scope?.let { { Text("Scope: $it", fontSize = 9.sp) } }
            )
        }
        item {
            Text(
                text = displayText,
                fontFamily = FontFamily.Monospace,
                fontSize = 10.sp,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                maxLines = if (expanded) Int.MAX_VALUE else 6,
                overflow = TextOverflow.Ellipsis
            )
        }
        if (isLong) {
            item {
                Button(
                    onClick = { expanded = !expanded },
                    label = { Text(if (expanded) "Less" else "More", fontSize = 10.sp) }
                )
            }
        }
        item {
            Button(
                onClick = {
                    state = formulaDisplayReduce(state, FormulaDisplayEvent.Copy)
                    onCopy()
                },
                label = {
                    Text(if (state == FormulaDisplayState.Copied) "Copied" else "Copy", fontSize = 10.sp)
                }
            )
        }
        description?.let { desc ->
            item {
                Chip(
                    onClick = {},
                    label = { Text("Description", fontSize = 11.sp) },
                    secondaryLabel = { Text(desc, fontSize = 9.sp, maxLines = 3) }
                )
            }
        }
    }
}
