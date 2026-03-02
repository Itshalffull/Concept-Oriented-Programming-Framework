// ============================================================
// Clef Surface Compose Widget — Select
//
// Dropdown single-choice selector. Shows a trigger displaying
// the selected value with a dropdown arrow. When expanded,
// displays a scrollable list of options. Maps the select.widget
// anatomy (root, label, trigger, valueDisplay, indicator,
// content, item, itemIndicator) to Material 3
// ExposedDropdownMenuBox with DropdownMenuItem.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

// --------------- Types ---------------

data class SelectOption(
    val label: String,
    val value: String,
    val disabled: Boolean = false,
)

// --------------- Component ---------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Select(
    value: String?,
    options: List<SelectOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Select...",
    label: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }

    val selectedLabel = remember(value, options) {
        options.find { it.value == value }?.label
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
                value = selectedLabel ?: "",
                onValueChange = {},
                readOnly = true,
                enabled = enabled,
                singleLine = true,
                placeholder = { Text(text = placeholder) },
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
                    val isSelected = option.value == value
                    val isEnabled = enabled && !option.disabled

                    DropdownMenuItem(
                        text = {
                            Text(
                                text = option.label,
                                color = if (isEnabled) {
                                    MaterialTheme.colorScheme.onSurface
                                } else {
                                    MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                                },
                            )
                        },
                        onClick = {
                            onValueChange(option.value)
                            expanded = false
                        },
                        enabled = isEnabled,
                        trailingIcon = if (isSelected) {
                            {
                                Icon(
                                    imageVector = Icons.Default.Check,
                                    contentDescription = "Selected",
                                    tint = MaterialTheme.colorScheme.primary,
                                )
                            }
                        } else {
                            null
                        },
                    )
                }
            }
        }
    }
}
