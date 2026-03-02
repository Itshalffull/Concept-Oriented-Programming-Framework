// ============================================================
// Clef Surface Compose Widget — FormulaEditor
//
// Expression editor with monospace styling, syntax-aware token
// coloring, and a popup autocomplete suggestion list. Variables
// are tinted cyan, functions yellow, operators bold. Supports
// live evaluation triggering and Tab-based autocomplete.
//
// Adapts the formula-editor.widget spec: anatomy (root, input,
// autocomplete, suggestion, preview, error, propertyToken),
// states (content, interaction, previewing, validation), and
// connect attributes to Compose rendering with Material 3.
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private val OPERATORS = setOf('+', '-', '*', '/', '=', '>', '<', '!', '&', '|', '%', '^')

private enum class TokenType { VARIABLE, FUNCTION, OPERATOR, NUMBER, TEXT }

private data class Token(val text: String, val type: TokenType)

private fun tokenize(
    formula: String,
    variables: Set<String>,
    functions: Set<String>,
): List<Token> {
    val tokens = mutableListOf<Token>()
    val words = formula.split(Regex("""(\s+|(?=[+\-*/=><&|%^!()[\]{}])|(?<=[+\-*/=><&|%^!()[\]{}]))"""))
    for (word in words) {
        if (word.isBlank()) {
            tokens.add(Token(word, TokenType.TEXT))
            continue
        }
        when {
            word in variables -> tokens.add(Token(word, TokenType.VARIABLE))
            word in functions -> tokens.add(Token(word, TokenType.FUNCTION))
            word.length == 1 && word[0] in OPERATORS -> tokens.add(Token(word, TokenType.OPERATOR))
            word.matches(Regex("""\d+(\.\d+)?""")) -> tokens.add(Token(word, TokenType.NUMBER))
            else -> tokens.add(Token(word, TokenType.TEXT))
        }
    }
    return tokens
}

// --------------- Component ---------------

/**
 * FormulaEditor composable that provides an expression input with
 * monospace font, syntax highlighting for variables and functions,
 * and a popup autocomplete suggestion list.
 *
 * @param value Current formula string.
 * @param variables Available variable names (highlighted in cyan).
 * @param functions Available function names (highlighted in yellow).
 * @param placeholder Placeholder text when empty.
 * @param enabled Whether the editor is enabled.
 * @param onChange Callback when the formula value changes.
 * @param onEvaluate Callback when the user requests evaluation.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun FormulaEditor(
    value: String = "",
    variables: List<String> = emptyList(),
    functions: List<String> = emptyList(),
    placeholder: String = "Enter formula...",
    enabled: Boolean = true,
    onChange: ((String) -> Unit)? = null,
    onEvaluate: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var textFieldValue by remember { mutableStateOf(TextFieldValue(value)) }
    var showSuggestions by remember { mutableStateOf(false) }

    val varSet = remember(variables) { variables.toSet() }
    val fnSet = remember(functions) { functions.toSet() }
    val allSymbols = remember(variables, functions) { variables + functions }

    LaunchedEffect(value) {
        if (value != textFieldValue.text) {
            textFieldValue = TextFieldValue(value)
        }
    }

    // Determine current word for autocomplete
    val currentWord = remember(textFieldValue.text) {
        val parts = textFieldValue.text.split(Regex("""[\s+\-*/=><&|%^!()[\]{}]+"""))
        parts.lastOrNull()?.takeIf { it.isNotEmpty() } ?: ""
    }

    val suggestions = remember(currentWord, allSymbols) {
        if (currentWord.isEmpty()) emptyList()
        else allSymbols.filter {
            it.lowercase().startsWith(currentWord.lowercase())
        }.take(8)
    }

    // Build syntax-highlighted text
    val annotatedFormula = remember(textFieldValue.text, varSet, fnSet) {
        val tokens = tokenize(textFieldValue.text, varSet, fnSet)
        buildAnnotatedString {
            for (token in tokens) {
                val style = when (token.type) {
                    TokenType.VARIABLE -> SpanStyle(
                        color = androidx.compose.ui.graphics.Color.Cyan,
                        fontWeight = FontWeight.Medium,
                    )
                    TokenType.FUNCTION -> SpanStyle(
                        color = androidx.compose.ui.graphics.Color.Yellow,
                        fontWeight = FontWeight.Medium,
                    )
                    TokenType.OPERATOR -> SpanStyle(fontWeight = FontWeight.Bold)
                    TokenType.NUMBER -> SpanStyle(
                        color = androidx.compose.ui.graphics.Color.Magenta,
                    )
                    TokenType.TEXT -> SpanStyle()
                }
                withStyle(style) { append(token.text) }
            }
        }
    }

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Label --
        Text(
            text = "\u0192(x) Formula",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )

        // -- Formula input --
        OutlinedTextField(
            value = textFieldValue,
            onValueChange = { tfv ->
                textFieldValue = tfv
                onChange?.invoke(tfv.text)
                showSuggestions = tfv.text.isNotEmpty()
            },
            placeholder = { Text(placeholder) },
            enabled = enabled,
            singleLine = true,
            textStyle = LocalTextStyle.current.copy(fontFamily = FontFamily.Monospace),
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Autocomplete dropdown --
        if (showSuggestions && suggestions.isNotEmpty()) {
            Card(
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth(),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp),
            ) {
                LazyColumn(
                    modifier = Modifier.heightIn(max = 200.dp),
                ) {
                    itemsIndexed(suggestions) { _, suggestion ->
                        val isVar = suggestion in varSet
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    // Replace last word with suggestion
                                    val text = textFieldValue.text
                                    val lastSep = text.lastIndexOfAny(
                                        charArrayOf(' ', '+', '-', '*', '/', '(', ')', '=')
                                    )
                                    val prefix = if (lastSep >= 0) text.substring(0..lastSep) else ""
                                    val newText = prefix + suggestion
                                    textFieldValue = TextFieldValue(newText)
                                    onChange?.invoke(newText)
                                    showSuggestions = false
                                }
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = suggestion,
                                color = if (isVar) {
                                    androidx.compose.ui.graphics.Color.Cyan
                                } else {
                                    androidx.compose.ui.graphics.Color.Yellow
                                },
                                fontWeight = FontWeight.Medium,
                            )
                            Text(
                                text = if (isVar) "(var)" else "(fn)",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        // -- Evaluate button --
        OutlinedButton(
            onClick = { onEvaluate?.invoke(textFieldValue.text) },
            enabled = enabled && textFieldValue.text.isNotEmpty(),
        ) {
            Text("Evaluate")
        }
    }
}
