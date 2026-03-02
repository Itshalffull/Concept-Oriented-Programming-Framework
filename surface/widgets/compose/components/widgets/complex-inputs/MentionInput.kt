// ============================================================
// Clef Surface Compose Widget — MentionInput
//
// Trigger-character autocomplete text input. When the trigger
// character (default "@") is typed, a popup dropdown of matching
// mention targets appears. Selecting a mention inserts it as a
// styled chip-like token in the text. Mention tokens are rendered
// with accent coloring.
//
// Adapts the mention-input.widget spec: anatomy (root, input,
// suggestions, suggestion, suggestionLabel, mentionChip), states
// (trigger, focus, navigation), and connect attributes to
// Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Mention(
    /** Unique identifier. */
    val id: String,
    /** Display label. */
    val label: String,
)

// --------------- Component ---------------

/**
 * MentionInput composable that provides a text field with trigger-
 * character based autocomplete. Typing the trigger character shows
 * a suggestion popup, and selecting a suggestion inserts the mention.
 *
 * @param value Current input value.
 * @param mentions Available mention targets.
 * @param trigger Character that triggers the mention dropdown (default "@").
 * @param placeholder Placeholder text when empty.
 * @param enabled Whether the input is enabled.
 * @param onChange Callback when the value changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun MentionInput(
    value: String = "",
    mentions: List<Mention> = emptyList(),
    trigger: String = "@",
    placeholder: String = "Type a message...",
    enabled: Boolean = true,
    onChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var textFieldValue by remember { mutableStateOf(TextFieldValue(value)) }
    var showSuggestions by remember { mutableStateOf(false) }
    var mentionQuery by remember { mutableStateOf("") }

    LaunchedEffect(value) {
        if (value != textFieldValue.text) {
            textFieldValue = TextFieldValue(value)
        }
    }

    // Filter mentions based on query
    val filteredMentions = remember(mentionQuery, mentions) {
        if (mentionQuery.isEmpty()) {
            mentions.take(10)
        } else {
            mentions.filter {
                it.label.lowercase().contains(mentionQuery.lowercase())
            }.take(10)
        }
    }

    // Build annotated string with mention highlights
    val annotatedText = remember(textFieldValue.text, trigger) {
        val text = textFieldValue.text
        val regex = Regex("${Regex.escape(trigger)}\\w+")
        buildAnnotatedString {
            var lastIndex = 0
            for (match in regex.findAll(text)) {
                if (match.range.first > lastIndex) {
                    append(text.substring(lastIndex, match.range.first))
                }
                withStyle(SpanStyle(
                    color = androidx.compose.ui.graphics.Color.Cyan,
                    fontWeight = FontWeight.Bold,
                )) {
                    append(match.value)
                }
                lastIndex = match.range.last + 1
            }
            if (lastIndex < text.length) {
                append(text.substring(lastIndex))
            }
        }
    }

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Text input --
        OutlinedTextField(
            value = textFieldValue,
            onValueChange = { tfv ->
                textFieldValue = tfv
                onChange?.invoke(tfv.text)

                // Detect trigger character
                val text = tfv.text
                val cursorPos = tfv.selection.start
                val textBeforeCursor = text.substring(0, minOf(cursorPos, text.length))
                val triggerIndex = textBeforeCursor.lastIndexOf(trigger)

                if (triggerIndex >= 0) {
                    val afterTrigger = textBeforeCursor.substring(triggerIndex + trigger.length)
                    if (!afterTrigger.contains(' ')) {
                        showSuggestions = true
                        mentionQuery = afterTrigger
                    } else {
                        showSuggestions = false
                        mentionQuery = ""
                    }
                } else {
                    showSuggestions = false
                    mentionQuery = ""
                }
            },
            placeholder = { Text(placeholder) },
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Suggestion dropdown --
        if (showSuggestions && filteredMentions.isNotEmpty()) {
            Card(
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            ) {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 200.dp),
                ) {
                    itemsIndexed(filteredMentions) { _, mention ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    // Replace trigger + query with mention
                                    val text = textFieldValue.text
                                    val cursorPos = textFieldValue.selection.start
                                    val textBeforeCursor = text.substring(
                                        0, minOf(cursorPos, text.length)
                                    )
                                    val triggerIndex = textBeforeCursor.lastIndexOf(trigger)
                                    if (triggerIndex >= 0) {
                                        val before = text.substring(0, triggerIndex)
                                        val after = if (cursorPos < text.length) {
                                            text.substring(cursorPos)
                                        } else ""
                                        val newText = "$before$trigger${mention.label} $after"
                                        textFieldValue = TextFieldValue(newText)
                                        onChange?.invoke(newText)
                                    }
                                    showSuggestions = false
                                    mentionQuery = ""
                                }
                                .padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                        ) {
                            Text(
                                text = "$trigger${mention.label}",
                                color = MaterialTheme.colorScheme.primary,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                    }
                }
            }
        }

        // -- No results --
        if (showSuggestions && filteredMentions.isEmpty() && mentionQuery.isNotEmpty()) {
            Text(
                text = "No matches for \"$mentionQuery\"",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
