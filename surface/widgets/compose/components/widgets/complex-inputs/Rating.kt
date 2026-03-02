// ============================================================
// Clef Surface Compose Widget — Rating
//
// Star-based rating input rendered as a Row of clickable star
// Icons. Supports whole and half-star precision with filled,
// half-filled, and empty star states. Visual feedback includes
// gold/yellow coloring for active stars and grey for empty.
//
// Adapts the rating.widget spec: anatomy (root, item, icon),
// states (item, interaction), and connect attributes to
// Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.StarHalf
import androidx.compose.material.icons.filled.StarBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Rating composable that renders a row of star icons for rating
 * input. Supports whole and half-star increments, with clickable
 * stars to set the value.
 *
 * @param value Current rating value.
 * @param max Maximum number of stars.
 * @param allowHalf Whether to allow half-star increments.
 * @param enabled Whether the rating is enabled.
 * @param label Visible label displayed before the stars.
 * @param onRatingChange Callback when the rating value changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Rating(
    value: Float = 0f,
    max: Int = 5,
    allowHalf: Boolean = false,
    enabled: Boolean = true,
    label: String? = null,
    onRatingChange: ((Float) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var internalValue by remember { mutableFloatStateOf(value) }
    val currentValue = if (value != 0f) value else internalValue

    LaunchedEffect(value) {
        internalValue = value
    }

    val starColor = Color(0xFFFFC107) // Gold/Amber
    val emptyColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(
        alpha = if (enabled) 0.4f else 0.2f,
    )
    val disabledAlpha = if (enabled) 1f else 0.38f

    Row(
        modifier = modifier.padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        // -- Label --
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
                modifier = Modifier.padding(end = 8.dp),
            )
        }

        // -- Stars --
        for (i in 1..max) {
            val icon = when {
                currentValue >= i.toFloat() -> Icons.Filled.Star
                allowHalf && currentValue >= i - 0.5f -> Icons.Filled.StarHalf
                else -> Icons.Filled.StarBorder
            }
            val tint = when {
                currentValue >= i.toFloat() -> starColor.copy(alpha = disabledAlpha)
                allowHalf && currentValue >= i - 0.5f -> starColor.copy(alpha = disabledAlpha)
                else -> emptyColor
            }

            Icon(
                imageVector = icon,
                contentDescription = "Star $i",
                tint = tint,
                modifier = Modifier
                    .size(32.dp)
                    .clickable(enabled = enabled) {
                        val newValue = if (allowHalf) {
                            // Tap on a fully filled star to set to half,
                            // tap on half or empty to set to full
                            if (currentValue == i.toFloat()) {
                                i - 0.5f
                            } else {
                                i.toFloat()
                            }
                        } else {
                            i.toFloat()
                        }
                        val clamped = newValue.coerceIn(0f, max.toFloat())
                        internalValue = clamped
                        onRatingChange?.invoke(clamped)
                    },
            )
        }

        // -- Numeric display --
        Text(
            text = "(${currentValue}/${max})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            modifier = Modifier.padding(start = 8.dp),
        )
    }
}
