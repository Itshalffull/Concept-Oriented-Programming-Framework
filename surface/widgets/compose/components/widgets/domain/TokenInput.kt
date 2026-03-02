// ============================================================
// Clef Surface Compose Widget — TokenInput
//
// Token pill input rendered as a Row of Chips with a TextField
// for adding new tokens. Existing tokens display as
// InputChips that can be removed. Typing filters available
// suggestions shown in a dropdown.
//
// Adapts the token-input.widget spec: anatomy (root, label,
// typeIcon, removeButton), states (static, hovered, focused,
// selected, removed), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.InputChip
import androidx.compose.material3.InputChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Token input with chips and a text field for adding new tokens.
 *
 * @param tokens Currently added tokens.
 * @param suggestions Available suggestions for autocompletion.
 * @param onAdd Callback to add a new token.
 * @param onRemove Callback to remove a token.
 * @param modifier Modifier for the root layout.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TokenInput(
    tokens: List<String>,
    suggestions: List<String> = emptyList(),
    onAdd: (String) -> Unit = {},
    onRemove: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var inputValue by remember { mutableStateOf("") }
    var showSuggestions by remember { mutableStateOf(false) }

    val filteredSuggestions by remember(suggestions, inputValue, tokens) {
        derivedStateOf {
            if (inputValue.isBlank()) emptyList()
            else {
                val lower = inputValue.lowercase()
                suggestions.filter {
                    it.lowercase().contains(lower) && it !in tokens
                }.take(5)
            }
        }
    }

    Column(modifier = modifier.padding(8.dp)) {
        // Token chips
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            tokens.forEach { token ->
                InputChip(
                    selected = false,
                    onClick = { onRemove(token) },
                    label = {
                        Text(
                            text = token,
                            fontWeight = FontWeight.Medium,
                        )
                    },
                    trailingIcon = {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Remove $token",
                        )
                    },
                )
            }
        }

        // Input field with suggestions
        Column {
            OutlinedTextField(
                value = inputValue,
                onValueChange = { newVal ->
                    inputValue = newVal
                    showSuggestions = newVal.isNotBlank()
                },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Add token...") },
                singleLine = true,
            )

            DropdownMenu(
                expanded = showSuggestions && filteredSuggestions.isNotEmpty(),
                onDismissRequest = { showSuggestions = false },
            ) {
                filteredSuggestions.forEach { suggestion ->
                    DropdownMenuItem(
                        text = { Text(suggestion) },
                        onClick = {
                            onAdd(suggestion)
                            inputValue = ""
                            showSuggestions = false
                        },
                    )
                }
            }
        }
    }
}
