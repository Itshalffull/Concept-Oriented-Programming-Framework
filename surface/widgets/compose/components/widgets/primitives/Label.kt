// ============================================================
// Clef Surface Compose Widget — Label
//
// Accessible label text for a form control. Renders label text
// with an optional red asterisk indicating required fields.
// Disabled state dims the text opacity.
//
// Adapts the label.widget spec: anatomy (root,
// requiredIndicator), states (static), and connect attributes
// (data-part, for, data-visible on requiredIndicator)
// to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle

// --------------- Component ---------------

/**
 * Label composable that renders accessible text for a form control
 * with an optional required-field indicator.
 *
 * @param text Label text content.
 * @param required Whether the associated field is required.
 * @param disabled Whether the associated control is disabled.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Label(
    text: String = "",
    required: Boolean = false,
    disabled: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Text(
        text = buildAnnotatedString {
            append(text)
            if (required) {
                withStyle(SpanStyle(color = MaterialTheme.colorScheme.error)) {
                    append(" *")
                }
            }
        },
        modifier = modifier,
        color = if (disabled) {
            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
        } else {
            MaterialTheme.colorScheme.onSurface
        },
        style = MaterialTheme.typography.bodyMedium,
    )
}
