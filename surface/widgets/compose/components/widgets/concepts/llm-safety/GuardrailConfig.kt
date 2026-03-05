package com.clef.surface.widgets.concepts.llmsafety

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

// --- State machine ---

enum class GuardrailConfigState { Viewing, RuleSelected, Testing, Adding }

sealed class GuardrailConfigEvent {
    data class SelectRule(val id: String) : GuardrailConfigEvent()
    object Test : GuardrailConfigEvent()
    object AddRule : GuardrailConfigEvent()
    object Deselect : GuardrailConfigEvent()
    object TestComplete : GuardrailConfigEvent()
    object Save : GuardrailConfigEvent()
    object Cancel : GuardrailConfigEvent()
}

fun guardrailConfigReduce(state: GuardrailConfigState, event: GuardrailConfigEvent): GuardrailConfigState = when (state) {
    GuardrailConfigState.Viewing -> when (event) {
        is GuardrailConfigEvent.SelectRule -> GuardrailConfigState.RuleSelected
        is GuardrailConfigEvent.Test -> GuardrailConfigState.Testing
        is GuardrailConfigEvent.AddRule -> GuardrailConfigState.Adding
        else -> state
    }
    GuardrailConfigState.RuleSelected -> when (event) {
        is GuardrailConfigEvent.Deselect -> GuardrailConfigState.Viewing
        else -> state
    }
    GuardrailConfigState.Testing -> when (event) {
        is GuardrailConfigEvent.TestComplete -> GuardrailConfigState.Viewing
        else -> state
    }
    GuardrailConfigState.Adding -> when (event) {
        is GuardrailConfigEvent.Save -> GuardrailConfigState.Viewing
        is GuardrailConfigEvent.Cancel -> GuardrailConfigState.Viewing
        else -> state
    }
}

// --- Types ---

data class GuardrailRule(
    val id: String,
    val name: String,
    val description: String,
    val enabled: Boolean,
    val type: String,
    val severity: String
)

data class TestResult(
    val ruleId: String,
    val ruleName: String,
    val triggered: Boolean,
    val severity: String
)

@Composable
fun GuardrailConfig(
    rules: List<GuardrailRule>,
    name: String,
    guardrailType: String,
    modifier: Modifier = Modifier,
    showTest: Boolean = true,
    onRuleToggle: (String, Boolean) -> Unit = { _, _ -> },
    onSeverityChange: (String, String) -> Unit = { _, _ -> },
    onTest: suspend (String) -> List<TestResult> = { emptyList() },
    onAddRule: () -> Unit = {}
) {
    var state by remember { mutableStateOf(GuardrailConfigState.Viewing) }
    var selectedRuleId by remember { mutableStateOf<String?>(null) }
    var testValue by remember { mutableStateOf("") }
    var testResults by remember { mutableStateOf<List<TestResult>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val severityOptions = listOf("block", "warn", "log")

    Column(modifier = modifier.semantics { contentDescription = "Guardrail config: $name" }) {
        // Header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            Text(name, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
            Surface(tonalElevation = 2.dp, shape = MaterialTheme.shapes.small) {
                Text(guardrailType, fontSize = 11.sp, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
            }
        }

        // Rule list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(rules) { _, rule ->
                val isSelected = selectedRuleId == rule.id
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp)
                        .clickable {
                            selectedRuleId = rule.id
                            state = guardrailConfigReduce(state, GuardrailConfigEvent.SelectRule(rule.id))
                        },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surface
                    )
                ) {
                    Column(Modifier.padding(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Toggle
                            Switch(
                                checked = rule.enabled,
                                onCheckedChange = { onRuleToggle(rule.id, !rule.enabled) },
                                modifier = Modifier.semantics { contentDescription = "Toggle ${rule.name}" }
                            )

                            Column(modifier = Modifier.weight(1f)) {
                                Text(rule.name, fontWeight = FontWeight.Medium, fontSize = 13.sp)
                                Text(rule.description, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }

                            // Type badge
                            Text(rule.type, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }

                        // Severity selector
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            modifier = Modifier.padding(top = 4.dp)
                        ) {
                            severityOptions.forEach { sev ->
                                FilterChip(
                                    selected = rule.severity == sev,
                                    onClick = { onSeverityChange(rule.id, sev) },
                                    label = { Text(sev, fontSize = 10.sp) },
                                    modifier = Modifier.height(28.dp)
                                )
                            }
                        }
                    }
                }
            }
        }

        // Add rule button
        TextButton(
            onClick = {
                state = guardrailConfigReduce(state, GuardrailConfigEvent.AddRule)
                onAddRule()
            },
            modifier = Modifier.padding(vertical = 4.dp)
        ) {
            Text("Add Rule", fontSize = 13.sp)
        }

        // Test area
        if (showTest) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text("Rule Tester", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)

            OutlinedTextField(
                value = testValue,
                onValueChange = { testValue = it },
                placeholder = { Text("Enter test input\u2026") },
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                minLines = 2
            )

            Button(
                onClick = {
                    state = guardrailConfigReduce(state, GuardrailConfigEvent.Test)
                    scope.launch {
                        try {
                            testResults = onTest(testValue)
                        } finally {
                            state = guardrailConfigReduce(state, GuardrailConfigEvent.TestComplete)
                        }
                    }
                },
                enabled = state != GuardrailConfigState.Testing && testValue.trim().isNotEmpty()
            ) {
                Text(if (state == GuardrailConfigState.Testing) "Testing\u2026" else "Test")
            }

            // Test results
            if (testResults.isNotEmpty()) {
                val triggered = testResults.filter { it.triggered }
                Text(
                    if (triggered.isEmpty()) "All rules passed"
                    else "${triggered.size} rule${if (triggered.size == 1) "" else "s"} triggered",
                    fontSize = 13.sp,
                    modifier = Modifier.padding(top = 4.dp)
                )
                testResults.forEach { result ->
                    Text(
                        "${result.ruleName}: ${if (result.triggered) result.severity else "pass"}",
                        fontSize = 12.sp,
                        color = if (result.triggered) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }
            }
        }
    }
}
