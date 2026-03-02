// ============================================================
// Clef Surface Compose Widget — MultiSelect
//
// Dropdown multi-choice selector. Displays a trigger showing
// the count of selected items with a dropdown containing
// checkbox-style items. Maps the multi-select.widget anatomy
// (root, label, trigger, content, item, itemIndicator) to
// Material 3 ExposedDropdownMenuBox with Checkbox menu items.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class MultiSelectOption(
    val label: String,
    val value: String,
    val disabled: Boolean = false,
)

// --------------- Component ---------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MultiSelect(
    value: List<String>,
    options: List<MultiSelectOption>,
    onValueChange: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }

    val displayText = remember(value, options) {
        when {
            value.isEmpty() -> "Select..."
            value.size == 1 -> options.find { it.value == value[0] }?.label ?: value[0]
            else -> "${value.size} selected"
        }
    }

    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
        }

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { if (enabled) expanded = it },
        ) {
            OutlinedTextField(
                value = displayText,
                onValueChange = {},
                readOnly = true,
                enabled = enabled,
                singleLine = true,
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                modifier = Modifier
                    .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                    .fillMaxWidth(),
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
            ) {
                options.forEach { option ->
                    val isChecked = option.value in value
                    val isEnabled = enabled && !option.disabled

                    DropdownMenuItem(
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = null,
                                    enabled = isEnabled,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = option.label,
                                    color = if (isEnabled) {
                                        MaterialTheme.colorScheme.onSurface
                                    } else {
                                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                                    },
                                )
                            }
                        },
                        onClick = {
                            if (isEnabled) {
                                val next = if (isChecked) {
                                    value - option.value
                                } else {
                                    value + option.value
                                }
                                onValueChange(next)
                            }
                        },
                        enabled = isEnabled,
                    )
                }
            }
        }
    }
}
