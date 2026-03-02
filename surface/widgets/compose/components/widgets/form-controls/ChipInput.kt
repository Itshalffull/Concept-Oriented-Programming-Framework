// ============================================================
// Clef Surface Compose Widget — ChipInput
//
// Free-form multi-value input that creates removable chips
// from typed text. Shows Material 3 InputChip components in a
// FlowRow followed by an inline text field. Enter adds a chip,
// backspace on empty input removes the last chip. Maps the
// chip-input.widget anatomy to Compose InputChip + TextField.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ChipInput(
    value: List<String>,
    onAdd: (String) -> Unit,
    onRemove: (Int) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Type and press Enter...",
    enabled: Boolean = true,
) {
    var inputText by remember { mutableStateOf("") }

    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // Render existing chips
        value.forEachIndexed { index, chip ->
            InputChip(
                selected = false,
                onClick = { if (enabled) onRemove(index) },
                label = { Text(text = chip) },
                enabled = enabled,
                trailingIcon = {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = "Remove $chip",
                        modifier = Modifier,
                    )
                },
                colors = InputChipDefaults.inputChipColors(),
            )
        }

        // Text input for new chips
        OutlinedTextField(
            value = inputText,
            onValueChange = { inputText = it },
            placeholder = { Text(text = placeholder) },
            enabled = enabled,
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(
                onDone = {
                    val trimmed = inputText.trim()
                    if (trimmed.isNotEmpty() && trimmed !in value) {
                        onAdd(trimmed)
                        inputText = ""
                    }
                },
            ),
            modifier = Modifier
                .weight(1f)
                .onKeyEvent { event ->
                    if (event.key == Key.Backspace && inputText.isEmpty() && value.isNotEmpty()) {
                        onRemove(value.lastIndex)
                        true
                    } else {
                        false
                    }
                },
        )
    }
}
