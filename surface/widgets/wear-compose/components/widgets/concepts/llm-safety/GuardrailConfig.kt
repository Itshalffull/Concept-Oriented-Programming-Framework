package com.clef.surface.widgets.concepts.llmsafety

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

enum class GuardrailConfigState { Viewing, RuleSelected }

sealed class GuardrailConfigEvent {
    data class SelectRule(val ruleId: String) : GuardrailConfigEvent()
    object Deselect : GuardrailConfigEvent()
}

fun guardrailConfigReduce(
    state: GuardrailConfigState,
    event: GuardrailConfigEvent
): GuardrailConfigState = when (state) {
    GuardrailConfigState.Viewing -> when (event) {
        is GuardrailConfigEvent.SelectRule -> GuardrailConfigState.RuleSelected
        else -> state
    }
    GuardrailConfigState.RuleSelected -> when (event) {
        is GuardrailConfigEvent.Deselect -> GuardrailConfigState.Viewing
        is GuardrailConfigEvent.SelectRule -> GuardrailConfigState.RuleSelected
    }
}

// --- Public types ---

enum class RuleSeverity { Block, Warn, Log }
enum class RuleType { Input, Output, Both }

data class GuardrailRule(
    val id: String,
    val name: String,
    val description: String,
    val severity: RuleSeverity,
    val type: RuleType,
    val enabled: Boolean = true
)

private val SEVERITY_ICONS = mapOf(
    RuleSeverity.Block to "\u26D4",
    RuleSeverity.Warn to "\u26A0",
    RuleSeverity.Log to "\u2139"
)

private val SEVERITY_COLORS = mapOf(
    RuleSeverity.Block to Color(0xFFEF4444),
    RuleSeverity.Warn to Color(0xFFF59E0B),
    RuleSeverity.Log to Color(0xFF3B82F6)
)

@Composable
fun GuardrailConfig(
    rules: List<GuardrailRule>,
    modifier: Modifier = Modifier,
    configName: String = "Guardrails",
    onRuleSelect: (GuardrailRule) -> Unit = {}
) {
    var state by remember { mutableStateOf(GuardrailConfigState.Viewing) }
    var selectedId by remember { mutableStateOf<String?>(null) }
    val listState = rememberScalingLazyListState()

    val enabled = rules.count { it.enabled }

    ScalingLazyColumn(
        modifier = modifier
            .fillMaxSize()
            .semantics { contentDescription = "Guardrail configuration" },
        state = listState,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        item {
            ListHeader {
                Text(
                    "$configName ($enabled/${rules.size})",
                    style = MaterialTheme.typography.titleSmall
                )
            }
        }

        items(rules) { rule ->
            val icon = SEVERITY_ICONS[rule.severity] ?: ""
            val color = SEVERITY_COLORS[rule.severity] ?: Color.Gray
            val isSelected = selectedId == rule.id
            val enabledIcon = if (rule.enabled) "\u2713" else "\u2717"

            Chip(
                onClick = {
                    val nextId = if (isSelected) null else rule.id
                    selectedId = nextId
                    state = guardrailConfigReduce(
                        state,
                        if (nextId != null) GuardrailConfigEvent.SelectRule(nextId)
                        else GuardrailConfigEvent.Deselect
                    )
                    onRuleSelect(rule)
                },
                label = {
                    Text(
                        text = "$enabledIcon $icon ${rule.name}",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        color = if (rule.enabled) color else Color.Gray
                    )
                },
                secondaryLabel = if (isSelected) {
                    {
                        Column {
                            Text(rule.description, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall)
                            Text("${rule.severity.name} | ${rule.type.name}", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                } else null
            )
        }
    }
}
