// ============================================================
// Clef Surface Compose Widget — CheckboxGroup
//
// Multi-choice selection from a visible list of checkboxes.
// Renders Material 3 Checkbox components in a Column or Row
// layout. Maps the checkbox-group.widget anatomy (root, label,
// items, item, itemControl, itemLabel) to Compose Checkbox
// with Row-based label alignment.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class CheckboxGroupOption(
    val label: String,
    val value: String,
    val disabled: Boolean = false,
)

enum class CheckboxGroupOrientation { Horizontal, Vertical }

// --------------- Component ---------------

@Composable
fun CheckboxGroup(
    value: List<String>,
    options: List<CheckboxGroupOption>,
    onValueChange: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    orientation: CheckboxGroupOrientation = CheckboxGroupOrientation.Vertical,
    enabled: Boolean = true,
) {
    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
        }

        val content: @Composable () -> Unit = {
            options.forEach { option ->
                val isChecked = option.value in value
                val isEnabled = enabled && !option.disabled

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.toggleable(
                        value = isChecked,
                        enabled = isEnabled,
                        role = Role.Checkbox,
                        onValueChange = { checked ->
                            val next = if (checked) {
                                value + option.value
                            } else {
                                value - option.value
                            }
                            onValueChange(next)
                        },
                    ),
                ) {
                    Checkbox(
                        checked = isChecked,
                        onCheckedChange = null, // handled by toggleable
                        enabled = isEnabled,
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = option.label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (isEnabled) {
                            MaterialTheme.colorScheme.onSurface
                        } else {
                            MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                        },
                    )
                }
            }
        }

        when (orientation) {
            CheckboxGroupOrientation.Vertical -> {
                Column { content() }
            }
            CheckboxGroupOrientation.Horizontal -> {
                Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) { content() }
            }
        }
    }
}
