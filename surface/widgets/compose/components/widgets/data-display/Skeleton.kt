// ============================================================
// Clef Surface Compose Widget — Skeleton
//
// Loading placeholder that mimics the shape of content being
// fetched. Renders shimmering shapes in place of actual content
// to reduce perceived load time. Compose adaptation: Box with
// an infinite shimmer animation using a horizontal gradient
// brush that translates across the surface.
// See widget spec: repertoire/widgets/data-display/skeleton.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

/** Shape variant for the skeleton placeholder. */
enum class SkeletonVariant {
    Text,
    Circle,
    Rect,
}

// --------------- Helpers ---------------

@Composable
private fun shimmerBrush(): Brush {
    val transition = rememberInfiniteTransition(label = "skeleton_shimmer")
    val translateX by transition.animateFloat(
        initialValue = -300f,
        targetValue = 300f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "skeleton_translate",
    )

    val baseColor = MaterialTheme.colorScheme.surfaceVariant
    val highlightColor = MaterialTheme.colorScheme.surface

    return Brush.linearGradient(
        colors = listOf(baseColor, highlightColor, baseColor),
        start = Offset(translateX, 0f),
        end = Offset(translateX + 300f, 0f),
    )
}

// --------------- Component ---------------

/**
 * Loading placeholder with shimmer animation mimicking content shape.
 *
 * @param variant Shape variant to render (text lines, circle, or rectangle).
 * @param width Width of the skeleton area.
 * @param height Height of the skeleton area (for rect variant).
 * @param lines Number of text lines (for text variant).
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Skeleton(
    variant: SkeletonVariant = SkeletonVariant.Text,
    width: Dp = 200.dp,
    height: Dp = 80.dp,
    lines: Int = 1,
    modifier: Modifier = Modifier,
) {
    val brush = shimmerBrush()

    when (variant) {
        SkeletonVariant.Circle -> {
            val diameter = minOf(width, height)
            Box(
                modifier = modifier
                    .size(diameter)
                    .clip(CircleShape)
                    .background(brush),
            )
        }

        SkeletonVariant.Rect -> {
            Box(
                modifier = modifier
                    .width(width)
                    .height(height)
                    .clip(RoundedCornerShape(8.dp))
                    .background(brush),
            )
        }

        SkeletonVariant.Text -> {
            Column(modifier = modifier) {
                repeat(lines) { index ->
                    // Last line shorter to simulate natural text
                    val lineWidth = if (index == lines - 1 && lines > 1) {
                        width * 0.6f
                    } else {
                        width
                    }
                    Box(
                        modifier = Modifier
                            .width(lineWidth)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush),
                    )
                    if (index < lines - 1) {
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }
}

/**
 * Convenience overload: full-width text skeleton with multiple lines.
 */
@Composable
fun SkeletonText(
    lines: Int = 3,
    modifier: Modifier = Modifier,
) {
    val brush = shimmerBrush()

    Column(modifier = modifier.fillMaxWidth()) {
        repeat(lines) { index ->
            val fraction = if (index == lines - 1 && lines > 1) 0.6f else 1f
            Box(
                modifier = Modifier
                    .fillMaxWidth(fraction)
                    .height(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush),
            )
            if (index < lines - 1) {
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}
