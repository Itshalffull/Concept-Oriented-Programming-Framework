package com.clef.surface.widgets.concepts.llmprompt

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

enum class PromptTemplateEditorState { Editing, MessageSelected, Compiling }

sealed class PromptTemplateEditorEvent {
    object AddMessage : PromptTemplateEditorEvent()
    data class RemoveMessage(val index: Int) : PromptTemplateEditorEvent()
    object Reorder : PromptTemplateEditorEvent()
    object Compile : PromptTemplateEditorEvent()
    data class SelectMessage(val index: Int) : PromptTemplateEditorEvent()
    object Deselect : PromptTemplateEditorEvent()
    object CompileComplete : PromptTemplateEditorEvent()
    object CompileError : PromptTemplateEditorEvent()
}

fun promptTemplateEditorReduce(state: PromptTemplateEditorState, event: PromptTemplateEditorEvent): PromptTemplateEditorState = when (state) {
    PromptTemplateEditorState.Editing -> when (event) {
        is PromptTemplateEditorEvent.AddMessage -> PromptTemplateEditorState.Editing
        is PromptTemplateEditorEvent.RemoveMessage -> PromptTemplateEditorState.Editing
        is PromptTemplateEditorEvent.Reorder -> PromptTemplateEditorState.Editing
        is PromptTemplateEditorEvent.Compile -> PromptTemplateEditorState.Compiling
        is PromptTemplateEditorEvent.SelectMessage -> PromptTemplateEditorState.MessageSelected
        else -> state
    }
    PromptTemplateEditorState.MessageSelected -> when (event) {
        is PromptTemplateEditorEvent.Deselect -> PromptTemplateEditorState.Editing
        is PromptTemplateEditorEvent.SelectMessage -> PromptTemplateEditorState.MessageSelected
        else -> state
    }
    PromptTemplateEditorState.Compiling -> when (event) {
        is PromptTemplateEditorEvent.CompileComplete -> PromptTemplateEditorState.Editing
        is PromptTemplateEditorEvent.CompileError -> PromptTemplateEditorState.Editing
        else -> state
    }
}

// --- Types ---

data class TemplateMessage(val role: String, val content: String)

data class TemplateVariable(
    val name: String,
    val type: String,
    val defaultValue: String? = null,
    val description: String? = null
)

// --- Helpers ---

private val VARIABLE_REGEX = Regex("""\{\{(\w+)\}\}""")

private fun extractVariables(content: String): List<String> =
    VARIABLE_REGEX.findAll(content).map { it.groupValues[1] }.toSet().toList()

private fun extractAllVariables(messages: List<TemplateMessage>): List<String> {
    val found = mutableSetOf<String>()
    for (msg in messages) {
        found.addAll(extractVariables(msg.content))
    }
    return found.toList()
}

private fun estimateTokens(text: String): Int = (text.length + 3) / 4

private fun resolveTemplate(content: String, values: Map<String, String>): String =
    VARIABLE_REGEX.replace(content) { match ->
        values[match.groupValues[1]] ?: match.value
    }

@Composable
fun PromptTemplateEditor(
    modifier: Modifier = Modifier,
    messages: List<TemplateMessage> = listOf(TemplateMessage("system", "")),
    variables: List<TemplateVariable> = emptyList(),
    modelId: String? = null,
    showParameters: Boolean = true,
    showTokenCount: Boolean = true,
    maxMessages: Int = 20,
    onMessagesChange: (List<TemplateMessage>) -> Unit = {},
    onCompile: (List<TemplateMessage>, Map<String, String>) -> Unit = { _, _ -> }
) {
    var state by remember { mutableStateOf(PromptTemplateEditorState.Editing) }
    var msgList by remember { mutableStateOf(messages) }
    var selectedIndex by remember { mutableIntStateOf(-1) }
    var previewMode by remember { mutableStateOf(false) }
    var variableValues by remember { mutableStateOf(mapOf<String, String>()) }

    // Sync external messages
    LaunchedEffect(messages) { msgList = messages }

    val detectedVarNames = remember(msgList) { extractAllVariables(msgList) }
    val allVariableNames = remember(detectedVarNames, variables) {
        (detectedVarNames + variables.map { it.name }).toSet().toList()
    }
    val varLookup = remember(variables) { variables.associateBy { it.name } }

    val resolvedValues = remember(allVariableNames, variableValues, varLookup) {
        allVariableNames.associateWith { name ->
            variableValues[name] ?: varLookup[name]?.defaultValue ?: ""
        }
    }

    val totalContent = remember(msgList) { msgList.joinToString("\n") { it.content } }
    val charCount = totalContent.length
    val tokenCount = estimateTokens(totalContent)

    val roles = listOf("system", "user", "assistant")

    Column(modifier = modifier.semantics { contentDescription = "Prompt template editor" }) {
        // Toolbar
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 8.dp)
        ) {
            TextButton(onClick = { previewMode = !previewMode }) {
                Text(if (previewMode) "Edit" else "Preview", fontSize = 13.sp)
            }
            Button(
                onClick = {
                    state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.Compile)
                    try {
                        onCompile(msgList, resolvedValues)
                        state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.CompileComplete)
                    } catch (_: Exception) {
                        state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.CompileError)
                    }
                },
                enabled = state != PromptTemplateEditorState.Compiling
            ) {
                Text(if (state == PromptTemplateEditorState.Compiling) "Compiling\u2026" else "Compile", fontSize = 13.sp)
            }
        }

        // Message list
        LazyColumn(modifier = Modifier.weight(1f)) {
            itemsIndexed(msgList) { index, msg ->
                val isSelected = selectedIndex == index
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clickable {
                            selectedIndex = index
                            state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.SelectMessage(index))
                        },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer
                        else MaterialTheme.colorScheme.surface
                    )
                ) {
                    Column(Modifier.padding(8.dp)) {
                        // Role selector and delete
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            // Role display with cycling on click
                            TextButton(onClick = {
                                val nextRole = roles[(roles.indexOf(msg.role) + 1) % roles.size]
                                val updated = msgList.toMutableList()
                                updated[index] = msg.copy(role = nextRole)
                                msgList = updated
                                onMessagesChange(msgList)
                            }) {
                                Text(msg.role, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                            }

                            Spacer(Modifier.weight(1f))

                            TextButton(
                                onClick = {
                                    if (msgList.size > 1) {
                                        val updated = msgList.toMutableList()
                                        updated.removeAt(index)
                                        msgList = updated
                                        onMessagesChange(msgList)
                                        if (selectedIndex == index) {
                                            selectedIndex = -1
                                            state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.Deselect)
                                        }
                                    }
                                },
                                enabled = msgList.size > 1
                            ) {
                                Text("Delete", fontSize = 11.sp)
                            }
                        }

                        // Content
                        if (previewMode) {
                            Text(
                                resolveTemplate(msg.content, resolvedValues),
                                fontFamily = FontFamily.Monospace,
                                fontSize = 13.sp,
                                modifier = Modifier.padding(top = 4.dp)
                            )
                        } else {
                            OutlinedTextField(
                                value = msg.content,
                                onValueChange = { newContent ->
                                    val updated = msgList.toMutableList()
                                    updated[index] = msg.copy(content = newContent)
                                    msgList = updated
                                    onMessagesChange(msgList)
                                },
                                placeholder = { Text("Enter ${msg.role} template\u2026 Use {{variable}} for placeholders") },
                                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 13.sp),
                                minLines = 3
                            )

                            // Variable pills
                            val msgVars = extractVariables(msg.content)
                            if (msgVars.isNotEmpty()) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                                    modifier = Modifier.padding(top = 4.dp)
                                ) {
                                    msgVars.forEach { varName ->
                                        val declared = varLookup[varName]
                                        Surface(
                                            tonalElevation = 2.dp,
                                            shape = MaterialTheme.shapes.small
                                        ) {
                                            Text(
                                                text = if (declared != null) "$varName: ${declared.type}" else varName,
                                                fontSize = 11.sp,
                                                color = MaterialTheme.colorScheme.primary,
                                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // Add message button
        TextButton(
            onClick = {
                if (msgList.size < maxMessages) {
                    msgList = msgList + TemplateMessage("user", "")
                    onMessagesChange(msgList)
                    state = promptTemplateEditorReduce(state, PromptTemplateEditorEvent.AddMessage)
                }
            },
            enabled = msgList.size < maxMessages,
            modifier = Modifier.padding(vertical = 4.dp)
        ) {
            Text("+ Add Message", fontSize = 13.sp)
        }

        // Variable panel
        if (allVariableNames.isNotEmpty()) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text("Variables", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            allVariableNames.forEach { varName ->
                val declared = varLookup[varName]
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 4.dp)
                ) {
                    Text(
                        "{{$varName}}${if (declared != null) " (${declared.type})" else ""}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        modifier = Modifier.width(120.dp)
                    )
                    OutlinedTextField(
                        value = variableValues[varName] ?: "",
                        onValueChange = { variableValues = variableValues + (varName to it) },
                        placeholder = { Text(declared?.defaultValue ?: "") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace, fontSize = 12.sp)
                    )
                }
            }
        }

        // Parameters panel
        if (showParameters && modelId != null) {
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            Text("Parameters", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(vertical = 4.dp)
            ) {
                Text("Model:", fontSize = 13.sp)
                Text(modelId, fontSize = 13.sp, color = MaterialTheme.colorScheme.primary)
            }
        }

        // Token count
        if (showTokenCount) {
            Text(
                "$charCount chars | ~$tokenCount tokens",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp)
            )
        }
    }
}
