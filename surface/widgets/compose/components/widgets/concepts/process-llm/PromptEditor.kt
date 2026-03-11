package com.clef.surface.widgets.concepts.processllm

import androidx.compose.foundation.layout.*
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

enum class PromptEditorState { Editing, Testing, Viewing }

sealed class PromptEditorEvent {
    object Test : PromptEditorEvent()
    object Input : PromptEditorEvent()
    data class TestComplete(val result: String?) : PromptEditorEvent()
    data class TestError(val error: String?) : PromptEditorEvent()
    object Edit : PromptEditorEvent()
}

fun promptEditorReduce(state: PromptEditorState, event: PromptEditorEvent): PromptEditorState = when (state) {
    PromptEditorState.Editing -> when (event) {
        is PromptEditorEvent.Test -> PromptEditorState.Testing
        is PromptEditorEvent.Input -> PromptEditorState.Editing
        else -> state
    }
    PromptEditorState.Testing -> when (event) {
        is PromptEditorEvent.TestComplete -> PromptEditorState.Viewing
        is PromptEditorEvent.TestError -> PromptEditorState.Editing
        else -> state
    }
    PromptEditorState.Viewing -> when (event) {
        is PromptEditorEvent.Edit -> PromptEditorState.Editing
        is PromptEditorEvent.Test -> PromptEditorState.Testing
        else -> state
    }
}

// --- Types ---

data class PromptMessage(
    val id: String,
    val role: String, // "system", "user", "assistant"
    val content: String
)

data class PromptTool(
    val name: String,
    val description: String? = null
)

// --- Helpers ---

private val VARIABLE_REGEX = Regex("""\{\{(\w+)\}\}""")

private fun extractVariables(text: String): List<String> =
    VARIABLE_REGEX.findAll(text).map { it.groupValues[1] }.toSet().toList()

private fun estimateTokens(text: String): Int = (text.length + 3) / 4

private val ROLE_LABELS = mapOf("system" to "System", "user" to "User", "assistant" to "Assistant")
private val ROLES = listOf("system", "user", "assistant")

private var nextMsgId = 1
private fun generateMsgId(): String = "msg-${nextMsgId++}"

@Composable
fun PromptEditor(
    userPrompt: String,
    model: String,
    tools: List<PromptTool>,
    modifier: Modifier = Modifier,
    systemPrompt: String? = null,
    showTest: Boolean = true,
    showTools: Boolean = true,
    showTokenCount: Boolean = true,
    messages: List<PromptMessage> = emptyList(),
    testResult: String? = null,
    testError: String? = null,
    onSystemPromptChange: (String) -> Unit = {},
    onUserPromptChange: (String) -> Unit = {},
    onMessagesChange: (List<PromptMessage>) -> Unit = {},
    onTest: () -> Unit = {}
) {
    var state by remember { mutableStateOf(PromptEditorState.Editing) }
    var systemText by remember { mutableStateOf(systemPrompt ?: "") }
    var userText by remember { mutableStateOf(userPrompt) }
    var msgList by remember { mutableStateOf(messages) }
    var lastTestResult by remember { mutableStateOf(testResult) }
    var lastTestError by remember { mutableStateOf(testError) }

    // Sync test results from props
    LaunchedEffect(testResult) {
        if (testResult != null && state == PromptEditorState.Testing) {
            lastTestResult = testResult
            state = promptEditorReduce(state, PromptEditorEvent.TestComplete(testResult))
        }
    }
    LaunchedEffect(testError) {
        if (testError != null && state == PromptEditorState.Testing) {
            lastTestError = testError
            state = promptEditorReduce(state, PromptEditorEvent.TestError(testError))
        }
    }

    val allText = remember(systemText, userText, msgList) {
        systemText + userText + msgList.joinToString("") { it.content }
    }
    val tokenCount = remember(allText) { estimateTokens(allText) }
    val detectedVariables = remember(allText) { extractVariables(allText) }

    Column(modifier = modifier.semantics { contentDescription = "Prompt editor" }) {
        // System prompt block
        Text("System", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        OutlinedTextField(
            value = systemText,
            onValueChange = {
                systemText = it
                state = promptEditorReduce(state, PromptEditorEvent.Input)
                onSystemPromptChange(it)
            },
            placeholder = { Text("System instructions\u2026") },
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            minLines = 2,
            textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        )

        // User prompt block
        Text("User", fontWeight = FontWeight.SemiBold, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary)
        OutlinedTextField(
            value = userText,
            onValueChange = {
                userText = it
                state = promptEditorReduce(state, PromptEditorEvent.Input)
                onUserPromptChange(it)
            },
            placeholder = { Text("User prompt template\u2026") },
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            minLines = 3,
            textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
        )

        // Additional messages
        msgList.forEachIndexed { index, msg ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(bottom = 2.dp)
            ) {
                // Role selector (cycle on click)
                TextButton(onClick = {
                    val nextRole = ROLES[(ROLES.indexOf(msg.role) + 1) % ROLES.size]
                    msgList = msgList.toMutableList().also { it[index] = msg.copy(role = nextRole) }
                    onMessagesChange(msgList)
                }) {
                    Text(ROLE_LABELS[msg.role] ?: msg.role, fontSize = 11.sp)
                }
                Spacer(Modifier.weight(1f))
                // Move up/down
                TextButton(onClick = {
                    if (index > 0) {
                        val updated = msgList.toMutableList()
                        val temp = updated[index - 1]
                        updated[index - 1] = updated[index]
                        updated[index] = temp
                        msgList = updated
                        onMessagesChange(msgList)
                    }
                }, enabled = index > 0) { Text("\u2191", fontSize = 12.sp) }
                TextButton(onClick = {
                    if (index < msgList.size - 1) {
                        val updated = msgList.toMutableList()
                        val temp = updated[index + 1]
                        updated[index + 1] = updated[index]
                        updated[index] = temp
                        msgList = updated
                        onMessagesChange(msgList)
                    }
                }, enabled = index < msgList.size - 1) { Text("\u2193", fontSize = 12.sp) }
                // Remove
                TextButton(onClick = {
                    msgList = msgList.toMutableList().also { it.removeAt(index) }
                    onMessagesChange(msgList)
                }) { Text("\u2715", fontSize = 12.sp) }
            }
            OutlinedTextField(
                value = msg.content,
                onValueChange = { newContent ->
                    msgList = msgList.toMutableList().also { it[index] = msg.copy(content = newContent) }
                    onMessagesChange(msgList)
                    state = promptEditorReduce(state, PromptEditorEvent.Input)
                },
                modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                minLines = 2,
                textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp)
            )
        }

        // Add message button
        TextButton(onClick = {
            msgList = msgList + PromptMessage(generateMsgId(), "user", "")
            onMessagesChange(msgList)
        }) {
            Text("+ Add Message", fontSize = 13.sp)
        }

        // Variable pills
        if (detectedVariables.isNotEmpty()) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.padding(vertical = 4.dp)
            ) {
                detectedVariables.forEach { variable ->
                    Surface(tonalElevation = 2.dp, shape = MaterialTheme.shapes.small) {
                        Text(
                            "{{$variable}}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        } else {
            Text("No template variables detected", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Model badge
        Text(model, fontSize = 12.sp, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(vertical = 4.dp))

        // Token count
        if (showTokenCount) {
            Text("~$tokenCount tokens", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }

        // Test button
        if (showTest) {
            Button(
                onClick = {
                    state = promptEditorReduce(state, PromptEditorEvent.Test)
                    onTest()
                },
                enabled = state != PromptEditorState.Testing,
                modifier = Modifier.padding(vertical = 4.dp)
            ) {
                Text(if (state == PromptEditorState.Testing) "Testing\u2026" else "Test Prompt")
            }
        }

        // Test result panel
        if (state == PromptEditorState.Viewing && lastTestResult != null) {
            Card(modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                Column(Modifier.padding(8.dp)) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Test Result", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        TextButton(onClick = { state = promptEditorReduce(state, PromptEditorEvent.Edit) }) {
                            Text("Edit", fontSize = 12.sp)
                        }
                    }
                    Text(lastTestResult!!, fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                }
            }
        }
        if (lastTestError != null) {
            Text(lastTestError!!, color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }

        // Tool list
        if (showTools && tools.isNotEmpty()) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text("Tools (${tools.size})", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            tools.forEach { tool ->
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(vertical = 2.dp)
                ) {
                    Text(tool.name, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                    if (tool.description != null) {
                        Spacer(Modifier.width(8.dp))
                        Text(tool.description, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
    }
}
