// ============================================================
// Clef Surface Compose Widget — ViewportProvider
//
// Reads device configuration and window size to provide Clef
// Surface Breakpoint values via CompositionLocal. Observes
// configuration changes to keep viewport state current.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

// --------------- Breakpoints ---------------

enum class Breakpoint { XS, SM, MD, LG, XL }
enum class Orientation { PORTRAIT, LANDSCAPE }

private val BREAKPOINT_THRESHOLDS = mapOf(
    Breakpoint.XS to 0.dp,
    Breakpoint.SM to 360.dp,
    Breakpoint.MD to 600.dp,
    Breakpoint.LG to 840.dp,
    Breakpoint.XL to 1200.dp,
)

private val BP_ORDER = listOf(
    Breakpoint.XS, Breakpoint.SM, Breakpoint.MD, Breakpoint.LG, Breakpoint.XL
)

// --------------- Context ---------------

data class ViewportContextValue(
    val width: Int,
    val height: Int,
    val breakpoint: Breakpoint,
    val orientation: Orientation,
    val isAtLeast: (Breakpoint) -> Boolean,
    val isAtMost: (Breakpoint) -> Boolean,
)

val LocalViewport = compositionLocalOf<ViewportContextValue?> { null }

@Composable
fun rememberViewport(): ViewportContextValue {
    return LocalViewport.current
        ?: error("rememberViewport must be used within a ViewportProvider.")
}

@Composable
fun rememberBreakpoint(): Breakpoint {
    return rememberViewport().breakpoint
}

// --------------- Component ---------------

@Composable
fun ViewportProvider(
    showInfo: Boolean = false,
    infoPosition: String = "bottom",
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val configuration = LocalConfiguration.current
    val widthDp = configuration.screenWidthDp.dp
    val heightDp = configuration.screenHeightDp.dp

    val breakpoint = remember(widthDp) {
        BP_ORDER.lastOrNull { widthDp >= (BREAKPOINT_THRESHOLDS[it] ?: 0.dp) }
            ?: Breakpoint.XS
    }

    val orientation = remember(widthDp, heightDp) {
        if (widthDp >= heightDp) Orientation.LANDSCAPE else Orientation.PORTRAIT
    }

    val contextValue = remember(widthDp, heightDp, breakpoint, orientation) {
        ViewportContextValue(
            width = widthDp.value.toInt(),
            height = heightDp.value.toInt(),
            breakpoint = breakpoint,
            orientation = orientation,
            isAtLeast = { bp -> BP_ORDER.indexOf(breakpoint) >= BP_ORDER.indexOf(bp) },
            isAtMost = { bp -> BP_ORDER.indexOf(breakpoint) <= BP_ORDER.indexOf(bp) },
        )
    }

    CompositionLocalProvider(LocalViewport provides contextValue) {
        Column(modifier = modifier) {
            if (showInfo && infoPosition == "top") {
                ViewportInfoBar(contextValue)
            }
            content()
            if (showInfo && infoPosition == "bottom") {
                ViewportInfoBar(contextValue)
            }
        }
    }
}

@Composable
private fun ViewportInfoBar(viewport: ViewportContextValue) {
    Text(
        text = "[viewport: ${viewport.width}x${viewport.height} bp:${viewport.breakpoint.name.lowercase()} ${viewport.orientation.name.lowercase()}]",
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}
