// ============================================================
// Clef Surface Compose Widget — ComboboxMulti
//
// Searchable multi-choice selector. Combines a text input
// with a filtered dropdown list of checkboxes. Selected values
// appear as chips above the input. Maps the combobox-multi
// widget anatomy (root, label, chipList, chip, input, content,
// item) to Material 3 ExposedDropdownMenuBox with InputChip
// and checkbox-style menu items.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ComboboxMultiOption(
    val label: String,
    val value: String,
)

// --------------- Component ---------------

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ComboboxMulti(
    value: List<String>,
    options: List<ComboboxMultiOption>,
    onValueChange: (List<String>) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search...",
    label: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    var inputText by remember { mutableStateOf("") }

    val filtered by remember(inputText, options) {
        derivedStateOf {
            if (inputText.isEmpty()) {
                options
            } else {
                val lower = inputText.lowercase()
                options.filter { it.label.lowercase().contains(lower) }
            }
        }
    }

    val labelOf: (String) -> String = { v ->
        options.find { it.value == v }?.label ?: v
    }

    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
        }

        // Selected chips
        if (value.isNotEmpty()) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                value.forEachIndexed { index, v ->
                    InputChip(
                        selected = true,
                        onClick = {
                            if (enabled) {
                                onValueChange(value.filterIndexed { i, _ -> i != index })
                            }
                        },
                        label = { Text(text = labelOf(v)) },
                        enabled = enabled,
                        trailingIcon = {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove ${labelOf(v)}",
                            )
                        },
                    )
                }
            }
        }

        // Searchable dropdown
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { if (enabled) expanded = it },
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { text ->
                    inputText = text
                    expanded = true
                },
                placeholder = {
                    Text(text = if (value.isEmpty()) placeholder else "")
                },
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
                onDismissRequest = {
                    expanded = false
                    inputText = ""
                },
            ) {
                if (filtered.isEmpty()) {
                    DropdownMenuItem(
                        text = {
                            Text(
                                text = "No results found",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        },
                        onClick = {},
                        enabled = false,
                    )
                } else {
                    filtered.forEach { option ->
                        val isChecked = option.value in value
                        DropdownMenuItem(
                            text = {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Checkbox(
                                        checked = isChecked,
                                        onCheckedChange = null,
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(text = option.label)
                                }
                            },
                            onClick = {
                                val next = if (isChecked) {
                                    value - option.value
                                } else {
                                    value + option.value
                                }
                                onValueChange(next)
                            },
                        )
                    }
                }
            }
        }
    }
}
