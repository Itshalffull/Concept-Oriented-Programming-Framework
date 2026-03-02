// ============================================================
// Clef Surface Compose Widget — Checkbox
//
// Boolean toggle control rendered with Material 3 Checkbox.
// Supports checked, unchecked, and indeterminate states with
// an optional label and required-field indicator.
//
// Adapts the checkbox.widget spec: anatomy (root, input,
// control, indicator, label), states (unchecked, checked,
// indeterminate, disabled, focused), and connect attributes
// (data-part, data-state, data-disabled) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Checkbox composable that renders a toggle control with an optional
 * label. Supports controlled and uncontrolled checked state as well
 * as the indeterminate tri-state.
 *
 * @param checked Whether the checkbox is checked (controlled).
 * @param indeterminate Whether the checkbox is in indeterminate state.
 * @param disabled Whether the checkbox is disabled.
 * @param label Label text displayed next to the checkbox.
 * @param required Whether the associated field is required.
 * @param onCheckedChange Callback when the checked value changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Checkbox(
    checked: Boolean? = null,
    indeterminate: Boolean = false,
    disabled: Boolean = false,
    label: String? = null,
    required: Boolean = false,
    onCheckedChange: ((Boolean) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var internalChecked by remember { mutableStateOf(checked ?: false) }
    val isChecked = checked ?: internalChecked

    LaunchedEffect(checked) {
        if (checked != null) {
            internalChecked = checked
        }
    }

    val toggleState = when {
        indeterminate -> ToggleableState.Indeterminate
        isChecked -> ToggleableState.On
        else -> ToggleableState.Off
    }

    Row(
        modifier = modifier.clickable(enabled = !disabled) {
            val next = !isChecked
            internalChecked = next
            onCheckedChange?.invoke(next)
        },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TriStateCheckbox(
            state = toggleState,
            onClick = if (disabled) null else {
                {
                    val next = !isChecked
                    internalChecked = next
                    onCheckedChange?.invoke(next)
                }
            },
            enabled = !disabled,
        )

        if (label != null) {
            Text(
                text = buildAnnotatedString {
                    append(label)
                    if (required) {
                        withStyle(SpanStyle(color = MaterialTheme.colorScheme.error)) {
                            append(" *")
                        }
                    }
                },
                modifier = Modifier.padding(start = 4.dp),
                color = if (disabled) {
                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
