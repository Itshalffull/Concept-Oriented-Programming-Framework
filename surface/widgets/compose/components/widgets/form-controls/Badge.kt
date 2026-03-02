// ============================================================
// Clef Surface Compose Widget — Badge
//
// Compact status indicator or count display. Renders as a
// colored label with filled, outline, or subtle variants.
// Maps the badge.widget anatomy (root, label) to Material 3
// Surface/Text with containerColor and contentColor support.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Types ---------------

enum class BadgeVariant { Filled, Outline, Subtle }
enum class BadgeSize { Sm, Md, Lg }

// --------------- Size Mapping ---------------

private fun BadgeSize.horizontalPadding() = when (this) {
    BadgeSize.Sm -> 4.dp
    BadgeSize.Md -> 8.dp
    BadgeSize.Lg -> 12.dp
}

private fun BadgeSize.verticalPadding() = when (this) {
    BadgeSize.Sm -> 0.dp
    BadgeSize.Md -> 2.dp
    BadgeSize.Lg -> 4.dp
}

private fun BadgeSize.fontSize() = when (this) {
    BadgeSize.Sm -> 10.sp
    BadgeSize.Md -> 12.sp
    BadgeSize.Lg -> 14.sp
}

// --------------- Component ---------------

@Composable
fun Badge(
    text: String,
    modifier: Modifier = Modifier,
    variant: BadgeVariant = BadgeVariant.Filled,
    size: BadgeSize = BadgeSize.Md,
    color: Color = MaterialTheme.colorScheme.primary,
) {
    val containerColor = when (variant) {
        BadgeVariant.Filled -> color
        BadgeVariant.Outline -> Color.Transparent
        BadgeVariant.Subtle -> color.copy(alpha = 0.12f)
    }

    val contentColor = when (variant) {
        BadgeVariant.Filled -> Color.White
        BadgeVariant.Outline -> color
        BadgeVariant.Subtle -> color
    }

    val border = when (variant) {
        BadgeVariant.Outline -> BorderStroke(1.dp, color)
        else -> null
    }

    Surface(
        modifier = modifier,
        shape = MaterialTheme.shapes.small,
        color = containerColor,
        contentColor = contentColor,
        border = border,
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(
                horizontal = size.horizontalPadding(),
                vertical = size.verticalPadding(),
            ),
            fontSize = size.fontSize(),
            fontWeight = FontWeight.Medium,
        )
    }
}
