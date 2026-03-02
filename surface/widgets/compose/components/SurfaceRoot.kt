// ============================================================
// Clef Surface Compose Widget — SurfaceRoot
//
// Top-level surface manager for Jetpack Compose. Handles the
// root rendering context: title bar, status bar, surface kind
// indicator, theme wrapping, and exit handling. Provides
// surface context via CompositionLocal.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

enum class SurfaceState { IDLE, ACTIVE, SUSPENDED, DESTROYED }

data class SurfaceStatus(
    val state: SurfaceState,
    val width: Int,
    val height: Int,
    val surfaceKind: String = "compose",
)

data class SurfaceContextValue(
    val status: SurfaceStatus,
    val title: String?,
    val exit: () -> Unit,
)

val LocalSurface = compositionLocalOf<SurfaceContextValue?> { null }

// --------------- Hooks ---------------

@Composable
fun rememberSurface(): SurfaceContextValue {
    return LocalSurface.current
        ?: error("rememberSurface must be used within a SurfaceRoot.")
}

@Composable
fun rememberSurfaceSize(): Pair<Int, Int> {
    val surface = rememberSurface()
    return surface.status.width to surface.status.height
}

// --------------- Component ---------------

@Composable
fun SurfaceRoot(
    title: String? = null,
    showStatusBar: Boolean = false,
    statusBarContent: String? = null,
    showSurfaceKind: Boolean = false,
    accentColor: Color = MaterialTheme.colorScheme.primary,
    onExit: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val configuration = LocalConfiguration.current
    val width = configuration.screenWidthDp
    val height = configuration.screenHeightDp

    val status = remember(width, height) {
        SurfaceStatus(
            state = SurfaceState.ACTIVE,
            width = width,
            height = height,
            surfaceKind = "compose",
        )
    }

    val exit = remember(onExit) { { onExit?.invoke() } }

    val contextValue = remember(status, title, exit) {
        SurfaceContextValue(
            status = status,
            title = title,
            exit = exit,
        )
    }

    CompositionLocalProvider(LocalSurface provides contextValue) {
        Scaffold(
            topBar = {
                if (title != null) {
                    TopAppBar(
                        title = {
                            Text(
                                text = title,
                                color = accentColor,
                            )
                        },
                        colors = TopAppBarDefaults.topAppBarColors(),
                    )
                }
            },
            bottomBar = {
                if (showStatusBar) {
                    BottomAppBar {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Text(
                                text = statusBarContent ?: "Clef Surface Compose",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                text = "${width}x${height}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            },
            modifier = modifier,
        ) { padding ->
            Column(
                modifier = Modifier
                    .padding(padding)
                    .fillMaxSize()
            ) {
                if (showSurfaceKind) {
                    Text(
                        text = "[surface: compose | ${width}x${height}]",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                content()
            }
        }
    }
}
