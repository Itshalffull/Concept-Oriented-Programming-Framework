// ============================================================
// Clef Surface Compose Widget — Separator
//
// Visual divider that separates content sections. Renders as
// a Material 3 Divider (horizontal) or a vertical thin line.
// Supports custom color and thickness.
//
// Adapts the separator.widget spec: anatomy (root), states
// (static), and connect attributes (role, aria-orientation,
// data-part, data-orientation) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Separator composable that renders a horizontal or vertical divider
 * using Material 3 color tokens.
 *
 * @param orientation Direction of the separator: "horizontal" or "vertical".
 * @param decorative Whether the separator is purely decorative.
 * @param color Color of the separator line; defaults to the outline variant.
 * @param thickness Thickness of the line in dp.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Separator(
    orientation: String = "horizontal",
    decorative: Boolean = false,
    color: Color = Color.Unspecified,
    thickness: Dp = 1.dp,
    modifier: Modifier = Modifier,
) {
    val resolvedColor = if (color == Color.Unspecified) {
        MaterialTheme.colorScheme.outlineVariant
    } else {
        color
    }

    if (orientation == "vertical") {
        Box(
            modifier = modifier
                .fillMaxHeight()
                .width(thickness)
                .background(resolvedColor),
        )
    } else {
        Box(
            modifier = modifier
                .fillMaxWidth()
                .height(thickness)
                .background(resolvedColor),
        )
    }
}
