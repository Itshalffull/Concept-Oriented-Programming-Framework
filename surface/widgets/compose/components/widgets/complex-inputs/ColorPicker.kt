// ============================================================
// Clef Surface Compose Widget — ColorPicker
//
// Color selection control using a hue/saturation Canvas, a
// brightness Slider, and a hex TextField for direct input.
// Displays a grid of preset color swatches and a live preview
// box showing the currently selected color.
//
// Adapts the color-picker.widget spec: anatomy (root, trigger,
// swatch, swatchGroup, swatchTrigger, input), states (popover,
// interaction, focus), and connect attributes to Compose
// rendering via Canvas drawing and Material 3 components.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private fun hsvToColor(hue: Float, saturation: Float, value: Float): Color {
    return Color.hsv(hue, saturation, value)
}

private fun colorToHex(color: Color): String {
    val argb = color.toArgb()
    return String.format("#%06X", 0xFFFFFF and argb)
}

private fun hexToColor(hex: String): Color? {
    return try {
        val cleaned = hex.removePrefix("#")
        if (cleaned.length != 6) return null
        val r = cleaned.substring(0, 2).toInt(16)
        val g = cleaned.substring(2, 4).toInt(16)
        val b = cleaned.substring(4, 6).toInt(16)
        Color(r, g, b)
    } catch (_: Exception) {
        null
    }
}

// --------------- Component ---------------

/**
 * ColorPicker composable that provides color selection through a
 * hue slider, saturation/brightness canvas, preset swatches, and
 * direct hex input.
 *
 * @param value Current color as a hex string (e.g. "#FF0000").
 * @param presets Array of preset color hex strings.
 * @param enabled Whether the picker is enabled.
 * @param onColorChange Callback when the selected color changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun ColorPicker(
    value: String = "#FF0000",
    presets: List<String> = listOf(
        "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
        "#FF00FF", "#00FFFF", "#FFFFFF", "#000000",
    ),
    enabled: Boolean = true,
    onColorChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var hue by remember { mutableFloatStateOf(0f) }
    var saturation by remember { mutableFloatStateOf(1f) }
    var brightness by remember { mutableFloatStateOf(1f) }
    var hexInput by remember { mutableStateOf(TextFieldValue(value)) }

    val currentColor = hsvToColor(hue, saturation, brightness)
    val currentHex = colorToHex(currentColor)

    // Sync from external value on change
    LaunchedEffect(value) {
        hexInput = TextFieldValue(value)
    }

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // -- Color preview box --
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(currentColor.copy(alpha = disabledAlpha))
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = currentHex,
                style = MaterialTheme.typography.labelLarge,
                color = if (brightness > 0.5f) Color.Black else Color.White,
            )
        }

        // -- Hue/Saturation canvas --
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .clip(RoundedCornerShape(8.dp)),
        ) {
            val w = size.width
            val h = size.height
            val cols = 36
            val rows = 10
            val cellW = w / cols
            val cellH = h / rows
            for (col in 0 until cols) {
                for (row in 0 until rows) {
                    val cellHue = (col.toFloat() / cols) * 360f
                    val cellSat = 1f - (row.toFloat() / rows)
                    val cellColor = hsvToColor(cellHue, cellSat, brightness)
                    drawRect(
                        color = cellColor.copy(alpha = disabledAlpha),
                        topLeft = Offset(col * cellW, row * cellH),
                        size = Size(cellW + 1, cellH + 1),
                    )
                }
            }
        }

        // -- Hue slider --
        Text(
            text = "Hue",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
        )
        Slider(
            value = hue,
            onValueChange = { newHue ->
                if (!enabled) return@Slider
                hue = newHue
                onColorChange?.invoke(colorToHex(hsvToColor(newHue, saturation, brightness)))
            },
            valueRange = 0f..360f,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Saturation slider --
        Text(
            text = "Saturation",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
        )
        Slider(
            value = saturation,
            onValueChange = { newSat ->
                if (!enabled) return@Slider
                saturation = newSat
                onColorChange?.invoke(colorToHex(hsvToColor(hue, newSat, brightness)))
            },
            valueRange = 0f..1f,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Brightness slider --
        Text(
            text = "Brightness",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
        )
        Slider(
            value = brightness,
            onValueChange = { newBri ->
                if (!enabled) return@Slider
                brightness = newBri
                onColorChange?.invoke(colorToHex(hsvToColor(hue, saturation, newBri)))
            },
            valueRange = 0f..1f,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Hex input --
        OutlinedTextField(
            value = hexInput,
            onValueChange = { tfv ->
                if (!enabled) return@OutlinedTextField
                hexInput = tfv
                val parsed = hexToColor(tfv.text)
                if (parsed != null) {
                    onColorChange?.invoke(tfv.text.uppercase())
                }
            },
            label = { Text("Hex Color") },
            singleLine = true,
            enabled = enabled,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Preset swatches --
        Text(
            text = "Presets",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            presets.forEach { preset ->
                val swatchColor = hexToColor(preset) ?: Color.Gray
                val isSelected = preset.equals(currentHex, ignoreCase = true)
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(swatchColor.copy(alpha = disabledAlpha))
                        .then(
                            if (isSelected) {
                                Modifier.border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                            } else {
                                Modifier.border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                            }
                        )
                        .clickable(enabled = enabled) {
                            val parsed = hexToColor(preset)
                            if (parsed != null) {
                                onColorChange?.invoke(preset)
                            }
                        },
                )
            }
        }
    }
}
