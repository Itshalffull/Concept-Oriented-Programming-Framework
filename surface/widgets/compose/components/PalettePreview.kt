// ============================================================
// Clef Surface Compose Widget — PalettePreview
//
// Displays a grid of Clef Surface design token color swatches
// using Compose. Parses hex/named colors from tokens and
// renders labeled color boxes for visual design review.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

@Composable
fun PalettePreview(
    tokens: Map<String, String> = emptyMap(),
    title: String = "Palette",
    columns: Int = 4,
    showLabels: Boolean = true,
    showValues: Boolean = false,
    swatchSize: Int = 48,
    modifier: Modifier = Modifier,
) {
    val colorTokens = tokens.filter { (_, value) ->
        value.startsWith("#") || value.startsWith("rgb")
    }

    Column(modifier = modifier) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(modifier = Modifier.height(8.dp))

        if (colorTokens.isEmpty()) {
            Text(
                text = "No color tokens found",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(columns),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(colorTokens.entries.toList()) { (name, value) ->
                    ColorSwatch(
                        name = name,
                        value = value,
                        size = swatchSize,
                        showLabel = showLabels,
                        showValue = showValues,
                    )
                }
            }
        }
    }
}

@Composable
private fun ColorSwatch(
    name: String,
    value: String,
    size: Int,
    showLabel: Boolean,
    showValue: Boolean,
) {
    val color = parseColor(value)

    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(4.dp))
                .background(color)
                .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
        )
        if (showLabel) {
            Text(
                text = name,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
        if (showValue) {
            Text(
                text = value,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
            )
        }
    }
}

private fun parseColor(value: String): Color {
    return try {
        when {
            value.startsWith("#") -> {
                val hex = value.removePrefix("#")
                when (hex.length) {
                    3 -> Color(
                        ("FF" + hex[0].toString().repeat(2) +
                            hex[1].toString().repeat(2) +
                            hex[2].toString().repeat(2)).toLong(16)
                    )
                    6 -> Color(("FF$hex").toLong(16))
                    8 -> Color(hex.toLong(16))
                    else -> Color.Gray
                }
            }
            else -> Color.Gray
        }
    } catch (_: Exception) {
        Color.Gray
    }
}
