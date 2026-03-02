// ============================================================
// Clef Surface Compose Widget — ElementRenderer
//
// Generic Compose renderer that maps Clef Surface ElementKind
// values to appropriate Material 3 components: TextField,
// Checkbox, RadioButton, Switch, Button, Slider, etc.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

// --------------- Element Config ---------------

data class ElementConfig(
    val id: String,
    val kind: String,
    val label: String? = null,
    val dataType: String? = null,
    val required: Boolean = false,
    val constraints: Map<String, Any>? = null,
)

// --------------- Component ---------------

@Composable
fun ElementRenderer(
    element: ElementConfig,
    value: Any? = null,
    focused: Boolean = false,
    error: String? = null,
    options: List<OptionItem>? = null,
    width: Int? = null,
    onChange: ((Any?) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.semantics {
            contentDescription = element.label ?: element.id
        }
    ) {
        // Label
        element.label?.let { label ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    color = if (focused) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
                if (element.required) {
                    Text(
                        text = " *",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
        }

        // Input based on kind
        when (element.kind) {
            "input-text" -> {
                var text by remember(value) { mutableStateOf(value?.toString() ?: "") }
                OutlinedTextField(
                    value = text,
                    onValueChange = {
                        text = it
                        onChange?.invoke(it)
                    },
                    isError = error != null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            "input-number" -> {
                var num by remember(value) { mutableStateOf(value?.toString() ?: "0") }
                OutlinedTextField(
                    value = num,
                    onValueChange = {
                        num = it
                        onChange?.invoke(it.toDoubleOrNull())
                    },
                    isError = error != null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            "input-bool" -> {
                var checked by remember(value) { mutableStateOf(value as? Boolean ?: false) }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = checked,
                        onCheckedChange = {
                            checked = it
                            onChange?.invoke(it)
                        },
                    )
                }
            }
            "selection-single" -> {
                var selectedIndex by remember { mutableStateOf(0) }
                options?.forEachIndexed { index, option ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 2.dp),
                    ) {
                        RadioButton(
                            selected = index == selectedIndex,
                            onClick = {
                                selectedIndex = index
                                onChange?.invoke(option.value)
                            },
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = option.label)
                    }
                }
            }
            "selection-multi" -> {
                val selected = remember { mutableStateListOf<String>() }
                options?.forEach { option ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(vertical = 2.dp),
                    ) {
                        Checkbox(
                            checked = option.value in selected,
                            onCheckedChange = {
                                if (it) selected.add(option.value)
                                else selected.remove(option.value)
                                onChange?.invoke(selected.toList())
                            },
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(text = option.label)
                    }
                }
            }
            "trigger" -> {
                Button(
                    onClick = { onChange?.invoke(true) },
                ) {
                    Text(text = element.label ?: "Action")
                }
            }
            "display" -> {
                Text(
                    text = value?.toString() ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            else -> {
                Text(
                    text = "[${element.kind}] ${value ?: ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // Error message
        error?.let {
            Text(
                text = it,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelSmall,
            )
        }
    }
}

data class OptionItem(
    val label: String,
    val value: String,
)
