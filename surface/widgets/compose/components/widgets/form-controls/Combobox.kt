// ============================================================
// Clef Surface Compose Widget — Combobox
//
// Searchable single-choice selector. Combines a text input
// with a filtered dropdown menu. As the user types, options
// are filtered in real time. Maps the combobox.widget anatomy
// (root, label, input, content, item) to Material 3
// ExposedDropdownMenuBox with filtering logic.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.ui.Modifier

// --------------- Types ---------------

data class ComboboxOption(
    val label: String,
    val value: String,
)

// --------------- Component ---------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun Combobox(
    value: String?,
    options: List<ComboboxOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search...",
    label: String? = null,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    var inputText by remember { mutableStateOf("") }

    val selectedLabel = remember(value, options) {
        options.find { it.value == value }?.label ?: ""
    }

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
                value = if (expanded) inputText else selectedLabel,
                onValueChange = { text ->
                    inputText = text
                    expanded = true
                },
                placeholder = { Text(text = placeholder) },
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
                        DropdownMenuItem(
                            text = { Text(text = option.label) },
                            onClick = {
                                onValueChange(option.value)
                                inputText = ""
                                expanded = false
                            },
                        )
                    }
                }
            }
        }
    }
}
