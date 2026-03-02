// ============================================================
// Clef Surface Compose Widget — TypographyText
//
// Renders text using Clef Surface typography scale tokens.
// Maps token names (display, heading, body, label, caption)
// to Material 3 typography styles.
// ============================================================

package clef.surface.compose.components

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow

// --------------- Component ---------------

@Composable
fun TypographyText(
    text: String,
    variant: String = "body",
    size: String = "md",
    weight: String? = null,
    color: Color = Color.Unspecified,
    align: TextAlign? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Clip,
    modifier: Modifier = Modifier,
) {
    val style = resolveTypographyStyle(variant, size)
    val fontWeight = when (weight) {
        "bold" -> FontWeight.Bold
        "semibold" -> FontWeight.SemiBold
        "medium" -> FontWeight.Medium
        "light" -> FontWeight.Light
        else -> style.fontWeight
    }

    Text(
        text = text,
        style = style.copy(fontWeight = fontWeight),
        color = color,
        textAlign = align,
        maxLines = maxLines,
        overflow = overflow,
        modifier = modifier,
    )
}

@Composable
private fun resolveTypographyStyle(variant: String, size: String): TextStyle {
    return when (variant) {
        "display" -> when (size) {
            "lg" -> MaterialTheme.typography.displayLarge
            "md" -> MaterialTheme.typography.displayMedium
            "sm" -> MaterialTheme.typography.displaySmall
            else -> MaterialTheme.typography.displayMedium
        }
        "heading" -> when (size) {
            "lg" -> MaterialTheme.typography.headlineLarge
            "md" -> MaterialTheme.typography.headlineMedium
            "sm" -> MaterialTheme.typography.headlineSmall
            else -> MaterialTheme.typography.headlineMedium
        }
        "title" -> when (size) {
            "lg" -> MaterialTheme.typography.titleLarge
            "md" -> MaterialTheme.typography.titleMedium
            "sm" -> MaterialTheme.typography.titleSmall
            else -> MaterialTheme.typography.titleMedium
        }
        "body" -> when (size) {
            "lg" -> MaterialTheme.typography.bodyLarge
            "md" -> MaterialTheme.typography.bodyMedium
            "sm" -> MaterialTheme.typography.bodySmall
            else -> MaterialTheme.typography.bodyMedium
        }
        "label" -> when (size) {
            "lg" -> MaterialTheme.typography.labelLarge
            "md" -> MaterialTheme.typography.labelMedium
            "sm" -> MaterialTheme.typography.labelSmall
            else -> MaterialTheme.typography.labelMedium
        }
        "caption" -> MaterialTheme.typography.labelSmall
        else -> MaterialTheme.typography.bodyMedium
    }
}
