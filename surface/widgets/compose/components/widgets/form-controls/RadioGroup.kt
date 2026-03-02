// ============================================================
// Clef Surface Compose Widget — RadioGroup
//
// Single-choice selection from a visible list of radio options.
// All options render simultaneously with Material 3 RadioButton
// indicators. Maps the radio-group.widget anatomy (root, label,
// items, item, itemControl, itemLabel) to Compose RadioButton
// in Column or Row layout.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class RadioGroupOption(
    val label: String,
    val value: String,
    val disabled: Boolean = false,
)

enum class RadioGroupOrientation { Horizontal, Vertical }

// --------------- Component ---------------

@Composable
fun RadioGroup(
    value: String?,
    options: List<RadioGroupOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    orientation: RadioGroupOrientation = RadioGroupOrientation.Vertical,
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
                val isSelected = option.value == value
                val isEnabled = enabled && !option.disabled

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.selectable(
                        selected = isSelected,
                        enabled = isEnabled,
                        role = Role.RadioButton,
                        onClick = { onValueChange(option.value) },
                    ),
                ) {
                    RadioButton(
                        selected = isSelected,
                        onClick = null, // handled by selectable
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
            RadioGroupOrientation.Vertical -> {
                Column(modifier = Modifier.selectableGroup()) { content() }
            }
            RadioGroupOrientation.Horizontal -> {
                Row(
                    modifier = Modifier.selectableGroup(),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) { content() }
            }
        }
    }
}
