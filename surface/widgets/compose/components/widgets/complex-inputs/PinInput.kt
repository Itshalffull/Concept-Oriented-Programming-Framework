// ============================================================
// Clef Surface Compose Widget — PinInput
//
// Segmented single-character input for verification codes and
// PINs. Renders as a Row of individual OutlinedTextFields, each
// accepting one character, with auto-advance on entry and
// optional masking. Focus automatically moves to the next cell
// on input and to the previous cell on backspace.
//
// Adapts the pin-input.widget spec: anatomy (root, label, input,
// separator), states (completion, focus), and connect attributes
// to Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Component ---------------

/**
 * PinInput composable that renders a row of single-character input
 * cells for verification codes and PINs. Auto-advances focus on
 * entry and supports masking.
 *
 * @param length Number of PIN cells.
 * @param value Current PIN value string.
 * @param mask Whether to mask entered characters with dots.
 * @param numeric Whether to accept only numeric input.
 * @param enabled Whether the input is enabled.
 * @param onChange Callback when the value changes.
 * @param onComplete Callback when all cells are filled.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun PinInput(
    length: Int = 4,
    value: String = "",
    mask: Boolean = false,
    numeric: Boolean = true,
    enabled: Boolean = true,
    onChange: ((String) -> Unit)? = null,
    onComplete: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val focusRequesters = remember(length) {
        List(length) { FocusRequester() }
    }
    var internalValue by remember { mutableStateOf(value) }
    val currentValue = value.ifEmpty { internalValue }

    LaunchedEffect(value) {
        internalValue = value
    }

    val disabledAlpha = if (enabled) 1f else 0.38f

    Row(
        modifier = modifier.padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (index in 0 until length) {
            val char = currentValue.getOrNull(index)?.toString() ?: ""
            var isCellFocused by remember { mutableStateOf(false) }

            val borderColor = when {
                !enabled -> MaterialTheme.colorScheme.outline.copy(alpha = 0.38f)
                isCellFocused -> MaterialTheme.colorScheme.primary
                char.isNotEmpty() -> MaterialTheme.colorScheme.outline
                else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
            }

            Box(
                modifier = Modifier
                    .size(48.dp)
                    .border(
                        width = if (isCellFocused) 2.dp else 1.dp,
                        color = borderColor,
                        shape = RoundedCornerShape(8.dp),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                BasicTextField(
                    value = char,
                    onValueChange = { newChar ->
                        if (!enabled) return@BasicTextField

                        val filtered = if (numeric) {
                            newChar.filter { it.isDigit() }
                        } else {
                            newChar.filter { it.isLetterOrDigit() }
                        }

                        val ch = filtered.lastOrNull()?.toString() ?: ""

                        if (ch.isNotEmpty()) {
                            // Build the updated value
                            val chars = currentValue.toMutableList()
                            while (chars.size <= index) chars.add(' ')
                            chars[index] = ch[0]
                            val newValue = String(chars.toCharArray())
                                .trimEnd()
                                .replace(" ", "")

                            internalValue = newValue
                            onChange?.invoke(newValue)

                            // Auto-advance to next cell
                            if (index < length - 1) {
                                focusRequesters[index + 1].requestFocus()
                            }

                            // Check completion
                            if (newValue.length == length) {
                                onComplete?.invoke(newValue)
                            }
                        } else if (newChar.isEmpty()) {
                            // Backspace: clear cell and move back
                            val chars = currentValue.toMutableList()
                            if (index < chars.size) {
                                chars.removeAt(index)
                            }
                            val newValue = String(chars.toCharArray()).trimEnd()
                            internalValue = newValue
                            onChange?.invoke(newValue)

                            if (index > 0) {
                                focusRequesters[index - 1].requestFocus()
                            }
                        }
                    },
                    enabled = enabled,
                    singleLine = true,
                    textStyle = TextStyle(
                        fontSize = 20.sp,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
                    ),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = if (numeric) KeyboardType.Number else KeyboardType.Text,
                    ),
                    visualTransformation = if (mask) {
                        PasswordVisualTransformation()
                    } else {
                        VisualTransformation.None
                    },
                    modifier = Modifier
                        .size(40.dp)
                        .focusRequester(focusRequesters[index])
                        .onFocusChanged { isCellFocused = it.isFocused },
                )
            }
        }
    }
}
