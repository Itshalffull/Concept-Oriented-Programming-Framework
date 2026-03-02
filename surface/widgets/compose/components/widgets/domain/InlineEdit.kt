// ============================================================
// Clef Surface Compose Widget — InlineEdit
//
// Click-to-edit inline text display. Shows value as plain Text
// when not editing; switches to a TextField when editing. Enter
// or focus loss confirms, Escape cancels and reverts.
//
// Adapts the inline-edit.widget spec: anatomy (root, display,
// displayText, editButton, input, confirmButton, cancelButton),
// states (displaying, focused, editing), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Text that becomes a TextField on click for inline editing.
 *
 * @param value Current text value.
 * @param placeholder Placeholder text when value is empty.
 * @param onSubmit Callback when editing is confirmed.
 * @param onCancel Callback when editing is cancelled.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun InlineEdit(
    value: String,
    placeholder: String = "Click to edit",
    onSubmit: (String) -> Unit = {},
    onCancel: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var isEditing by remember { mutableStateOf(false) }
    var editValue by remember(value) { mutableStateOf(value) }
    val focusRequester = remember { FocusRequester() }

    if (isEditing) {
        LaunchedEffect(Unit) {
            focusRequester.requestFocus()
        }

        Row(
            modifier = modifier,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            OutlinedTextField(
                value = editValue,
                onValueChange = { editValue = it },
                modifier = Modifier
                    .weight(1f)
                    .focusRequester(focusRequester)
                    .onKeyEvent { event ->
                        if (event.key == Key.Escape) {
                            editValue = value
                            isEditing = false
                            onCancel()
                            true
                        } else {
                            false
                        }
                    },
                singleLine = true,
                placeholder = { Text(placeholder) },
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(
                    onDone = {
                        onSubmit(editValue)
                        isEditing = false
                    },
                ),
            )
            Spacer(modifier = Modifier.width(4.dp))
            IconButton(onClick = {
                onSubmit(editValue)
                isEditing = false
            }) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Confirm",
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
            IconButton(onClick = {
                editValue = value
                isEditing = false
                onCancel()
            }) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Cancel",
                    tint = MaterialTheme.colorScheme.error,
                )
            }
        }
    } else {
        Row(
            modifier = modifier
                .clickable { isEditing = true }
                .padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = value.ifEmpty { placeholder },
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Normal,
                color = if (value.isEmpty())
                    MaterialTheme.colorScheme.onSurfaceVariant
                else
                    MaterialTheme.colorScheme.onSurface,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Default.Edit,
                contentDescription = "Edit",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
