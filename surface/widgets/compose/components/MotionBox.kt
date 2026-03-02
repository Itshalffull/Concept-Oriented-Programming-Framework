// ============================================================
// Clef Surface Compose Widget — MotionBox
//
// Compose container that applies Clef Surface motion tokens
// as animated transitions. Maps motion presets (fade, slide,
// scale, expand) to Compose animation specs using
// AnimatedVisibility and animate*AsState APIs.
// ============================================================

package clef.surface.compose.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.graphicsLayer

// --------------- Motion Presets ---------------

enum class MotionPreset {
    FADE, SLIDE_UP, SLIDE_DOWN, SLIDE_LEFT, SLIDE_RIGHT,
    SCALE, EXPAND, NONE
}

enum class MotionDuration(val ms: Int) {
    INSTANT(0), FAST(150), NORMAL(300), SLOW(500), VERY_SLOW(1000)
}

// --------------- Component ---------------

@Composable
fun MotionBox(
    visible: Boolean = true,
    preset: MotionPreset = MotionPreset.FADE,
    duration: MotionDuration = MotionDuration.NORMAL,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val spec = tween<Float>(durationMillis = duration.ms)

    when (preset) {
        MotionPreset.NONE -> {
            if (visible) {
                Box(modifier = modifier, content = content)
            }
        }
        MotionPreset.FADE -> {
            val alpha by animateFloatAsState(
                targetValue = if (visible) 1f else 0f,
                animationSpec = spec,
                label = "fade",
            )
            Box(
                modifier = modifier.alpha(alpha),
                content = content,
            )
        }
        MotionPreset.SCALE -> {
            val scale by animateFloatAsState(
                targetValue = if (visible) 1f else 0f,
                animationSpec = spec,
                label = "scale",
            )
            Box(
                modifier = modifier.scale(scale),
                content = content,
            )
        }
        MotionPreset.SLIDE_UP, MotionPreset.SLIDE_DOWN,
        MotionPreset.SLIDE_LEFT, MotionPreset.SLIDE_RIGHT -> {
            AnimatedVisibility(
                visible = visible,
                enter = when (preset) {
                    MotionPreset.SLIDE_UP -> slideInVertically { it } + fadeIn()
                    MotionPreset.SLIDE_DOWN -> slideInVertically { -it } + fadeIn()
                    MotionPreset.SLIDE_LEFT -> slideInHorizontally { it } + fadeIn()
                    MotionPreset.SLIDE_RIGHT -> slideInHorizontally { -it } + fadeIn()
                    else -> fadeIn()
                },
                exit = when (preset) {
                    MotionPreset.SLIDE_UP -> slideOutVertically { -it } + fadeOut()
                    MotionPreset.SLIDE_DOWN -> slideOutVertically { it } + fadeOut()
                    MotionPreset.SLIDE_LEFT -> slideOutHorizontally { -it } + fadeOut()
                    MotionPreset.SLIDE_RIGHT -> slideOutHorizontally { it } + fadeOut()
                    else -> fadeOut()
                },
                modifier = modifier,
            ) {
                Box(content = content)
            }
        }
        MotionPreset.EXPAND -> {
            AnimatedVisibility(
                visible = visible,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
                modifier = modifier,
            ) {
                Box(content = content)
            }
        }
    }
}
