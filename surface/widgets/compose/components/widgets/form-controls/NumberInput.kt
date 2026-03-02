// ============================================================
// Clef Surface Compose Widget — NumberInput
//
// Numeric input with increment/decrement controls. Renders an
// OutlinedTextField with number validation and optional +/-
// icon buttons. Respects min, max, and step constraints. Maps
// the number-input.widget anatomy (root, label, input,
// incrementButton, decrementButton) to Material 3 components.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

@Composable
fun NumberInput(
    value: Number,
    onValueChange: (Number) -> Unit,
    modifier: Modifier = Modifier,
    min: Double? = null,
    max: Double? = null,
    step: Double = 1.0,
    label: String? = null,
    enabled: Boolean = true,
) {
    var textValue by remember(value) { mutableStateOf(value.toString()) }

    fun clamp(n: Double): Double {
        var result = n
        if (min != null && result < min) result = min
        if (max != null && result > max) result = max
        return result
    }

    fun increment() {
        val current = value.toDouble()
        val next = clamp(current + step)
        onValueChange(next)
    }

    fun decrement() {
        val current = value.toDouble()
        val next = clamp(current - step)
        onValueChange(next)
    }

    val atMin = min != null && value.toDouble() <= min
    val atMax = max != null && value.toDouble() >= max

    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(
                onClick = { decrement() },
                enabled = enabled && !atMin,
            ) {
                Icon(
                    imageVector = Icons.Default.Remove,
                    contentDescription = "Decrement",
                )
            }

            OutlinedTextField(
                value = textValue,
                onValueChange = { newText ->
                    textValue = newText
                    newText.toDoubleOrNull()?.let { parsed ->
                        onValueChange(clamp(parsed))
                    }
                },
                enabled = enabled,
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.width(120.dp),
            )

            IconButton(
                onClick = { increment() },
                enabled = enabled && !atMax,
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Increment",
                )
            }
        }
    }
}
