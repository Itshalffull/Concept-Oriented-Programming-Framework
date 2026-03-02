// ============================================================
// Clef Surface Compose Widget — ElevationBox
//
// Compose container that applies Clef Surface elevation tokens
// as Material 3 shadow/tonal elevation. Maps elevation levels
// (0-5) to dp values and optional surface tint colors.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Elevation Scale ---------------

private val ELEVATION_SCALE = mapOf(
    0 to 0.dp,
    1 to 1.dp,
    2 to 3.dp,
    3 to 6.dp,
    4 to 8.dp,
    5 to 12.dp,
)

// --------------- Component ---------------

@Composable
fun ElevationBox(
    level: Int = 1,
    shape: Shape = RoundedCornerShape(8.dp),
    color: Color = MaterialTheme.colorScheme.surface,
    contentColor: Color = MaterialTheme.colorScheme.onSurface,
    padding: Dp = 0.dp,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val elevation = ELEVATION_SCALE[level.coerceIn(0, 5)] ?: 0.dp

    Surface(
        modifier = modifier,
        shape = shape,
        color = color,
        contentColor = contentColor,
        tonalElevation = elevation,
        shadowElevation = elevation,
    ) {
        Box(
            modifier = Modifier.padding(padding),
            content = content,
        )
    }
}
