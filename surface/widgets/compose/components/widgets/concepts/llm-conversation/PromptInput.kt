package com.clef.surface.widgets.concepts.llmconversation

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

// --- State machine ---

enum class PromptInputState { Empty, Composing, Submitting }

sealed class PromptInputEvent {
    object Input : PromptInputEvent()
    object Paste : PromptInputEvent()
    object Attach : PromptInputEvent()
    object Clear : PromptInputEvent()
    object Submit : PromptInputEvent()
    object SubmitComplete : PromptInputEvent()
    object SubmitError : PromptInputEvent()
}

fun promptInputReduce(state: PromptInputState, event: PromptInputEvent): PromptInputState = when (state) {
    PromptInputState.Empty -> when (event) {
        is PromptInputEvent.Input -> PromptInputState.Composing
        is PromptInputEvent.Paste -> PromptInputState.Composing
        is PromptInputEvent.Attach -> PromptInputState.Composing
        else -> state
    }
    PromptInputState.Composing -> when (event) {
        is PromptInputEvent.Clear -> PromptInputState.Empty
        is PromptInputEvent.Submit -> PromptInputState.Submitting
        else -> state
    }
    PromptInputState.Submitting -> when (event) {
        is PromptInputEvent.SubmitComplete -> PromptInputState.Empty
        is PromptInputEvent.SubmitError -> PromptInputState.Composing
        else -> state
    }
}

@Composable
fun PromptInput(
    value: String,
    modifier: Modifier = Modifier,
    placeholder: String = "Type a message\u2026",
    maxLength: Int? = null,
    showAttach: Boolean = true,
    disabled: Boolean = false,
    onChange: (String) -> Unit = {},
    onSubmit: suspend (String) -> Unit = {},
    onAttach: () -> Unit = {}
) {
    var state by remember { mutableStateOf(if (value.isNotEmpty()) PromptInputState.Composing else PromptInputState.Empty) }
    val focusRequester = remember { FocusRequester() }
    val scope = rememberCoroutineScope()

    val isSubmitDisabled = state == PromptInputState.Empty || state == PromptInputState.Submitting || disabled
    val isInputDisabled = state == PromptInputState.Submitting || disabled

    // Focus on mount
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Column(
        modifier = modifier.semantics { contentDescription = "Message input" }
    ) {
        // Text field
        OutlinedTextField(
            value = value,
            onValueChange = { newValue ->
                onChange(newValue)
                state = if (newValue.isEmpty()) {
                    promptInputReduce(state, PromptInputEvent.Clear)
                } else {
                    promptInputReduce(state, PromptInputEvent.Input)
                }
            },
            placeholder = { Text(placeholder) },
            enabled = !isInputDisabled,
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focusRequester),
            maxLines = 6,
            singleLine = false
        )

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
        ) {
            // Attach button
            if (showAttach) {
                TextButton(
                    onClick = {
                        state = promptInputReduce(state, PromptInputEvent.Attach)
                        onAttach()
                    },
                    enabled = !isInputDisabled
                ) {
                    Text("Attach", fontSize = 12.sp)
                }
            }

            // Character counter
            Spacer(Modifier.weight(1f))
            Text(
                text = if (maxLength != null) "${value.length} / $maxLength" else "${value.length}",
                fontSize = 11.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Submit button
            Button(
                onClick = {
                    if (!isSubmitDisabled && value.trim().isNotEmpty()) {
                        state = promptInputReduce(state, PromptInputEvent.Submit)
                        scope.launch {
                            try {
                                onSubmit(value)
                                state = promptInputReduce(state, PromptInputEvent.SubmitComplete)
                            } catch (_: Exception) {
                                state = promptInputReduce(state, PromptInputEvent.SubmitError)
                            }
                        }
                    }
                },
                enabled = !isSubmitDisabled
            ) {
                Text(if (state == PromptInputState.Submitting) "Sending\u2026" else "Send")
            }
        }
    }
}
