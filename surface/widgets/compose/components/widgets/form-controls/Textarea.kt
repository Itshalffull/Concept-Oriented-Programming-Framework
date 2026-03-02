// ============================================================
// Clef Surface Compose Widget — Textarea
//
// Multi-line text input area. Renders a Material 3
// OutlinedTextField configured for multiple lines with
// optional character count. Maps the textarea.widget anatomy
// (root, label, textarea, charCount) to Compose
// OutlinedTextField with minLines/maxLines configuration.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

@Composable
fun Textarea(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    minLines: Int = 3,
    maxLines: Int = Int.MAX_VALUE,
    enabled: Boolean = true,
    label: String? = null,
    maxLength: Int? = null,
) {
    Column(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = { newValue ->
                if (maxLength == null || newValue.length <= maxLength) {
                    onValueChange(newValue)
                }
            },
            placeholder = {
                if (placeholder.isNotEmpty()) {
                    Text(text = placeholder)
                }
            },
            label = if (label != null) {
                { Text(text = label) }
            } else {
                null
            },
            enabled = enabled,
            minLines = minLines,
            maxLines = maxLines,
            modifier = Modifier.fillMaxWidth(),
        )

        if (maxLength != null) {
            Text(
                text = "${value.length} / $maxLength",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .align(Alignment.End)
                    .padding(top = 4.dp),
            )
        }
    }
}
