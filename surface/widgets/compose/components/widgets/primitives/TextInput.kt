// ============================================================
// Clef Surface Compose Widget — TextInput
//
// Single-line text entry field rendered with Material 3
// OutlinedTextField. Supports controlled and uncontrolled
// value, placeholder, label, disabled, read-only, and
// required-field states.
//
// Adapts the text-input.widget spec: anatomy (root, label,
// input, description, error, prefix, suffix, clearButton),
// states (empty, filled, idle, focused, valid, invalid,
// disabled, readOnly), and connect attributes (data-part,
// data-state, data-focus, value, placeholder) to Compose
// rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle

// --------------- Component ---------------

/**
 * TextInput composable that renders a single-line text field with
 * Material 3 OutlinedTextField styling. Supports both controlled
 * (via [value]) and uncontrolled modes.
 *
 * @param value Current value of the text field (controlled).
 * @param placeholder Placeholder text shown when the value is empty.
 * @param disabled Whether the text input is disabled.
 * @param readOnly Whether the text input is read-only.
 * @param label Optional label text above the input.
 * @param required Whether the field is required (appends red asterisk to label).
 * @param onValueChange Callback when the text value changes.
 * @param onSubmit Callback when the IME action (Done/Enter) is triggered.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun TextInput(
    value: String? = null,
    placeholder: String = "",
    disabled: Boolean = false,
    readOnly: Boolean = false,
    label: String? = null,
    required: Boolean = false,
    onValueChange: ((String) -> Unit)? = null,
    onSubmit: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var internalValue by remember { mutableStateOf(value ?: "") }
    val currentValue = value ?: internalValue

    LaunchedEffect(value) {
        if (value != null) {
            internalValue = value
        }
    }

    val labelComposable: @Composable (() -> Unit)? = if (label != null) {
        {
            Text(
                text = buildAnnotatedString {
                    append(label)
                    if (required) {
                        withStyle(SpanStyle(color = MaterialTheme.colorScheme.error)) {
                            append(" *")
                        }
                    }
                },
            )
        }
    } else {
        null
    }

    val placeholderComposable: @Composable (() -> Unit)? = if (placeholder.isNotEmpty()) {
        { Text(text = placeholder) }
    } else {
        null
    }

    OutlinedTextField(
        value = currentValue,
        onValueChange = { newValue ->
            internalValue = newValue
            onValueChange?.invoke(newValue)
        },
        modifier = modifier,
        enabled = !disabled,
        readOnly = readOnly,
        label = labelComposable,
        placeholder = placeholderComposable,
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            imeAction = if (onSubmit != null) ImeAction.Done else ImeAction.Default,
        ),
        keyboardActions = KeyboardActions(
            onDone = {
                onSubmit?.invoke(currentValue)
            },
        ),
    )
}
