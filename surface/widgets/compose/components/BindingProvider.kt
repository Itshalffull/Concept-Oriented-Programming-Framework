// ============================================================
// Clef Surface Compose Widget — BindingProvider
//
// Manages Clef Surface concept binding in Compose context.
// Provides signal-based data flow via CompositionLocal and
// renders connection status indicators using Material 3.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

enum class ConnectionState(val icon: String, val color: Color) {
    DISCONNECTED("\u25CB", Color.Gray),
    CONNECTING("\u25D4", Color(0xFFFFC107)),
    CONNECTED("\u25CF", Color(0xFF4CAF50)),
    ERROR("\u2716", Color(0xFFF44336)),
    STALE("\u25D2", Color(0xFFFFC107)),
}

enum class BindingMode(val label: String, val icon: String) {
    COUPLED("Coupled", "\u21C4"),
    REST("REST", "\u21BB"),
    GRAPHQL("GraphQL", "\u25C6"),
    STATIC("Static", "\u25A0"),
}

data class BindingConfig(
    val concept: String,
    val mode: BindingMode,
    val endpoint: String? = null,
    val signalMap: Map<String, Any> = emptyMap(),
)

// --------------- Context ---------------

data class BindingContextValue(
    val binding: BindingConfig,
    val connectionState: ConnectionState,
    val readSignal: (String) -> Any?,
    val invoke: suspend (String, Map<String, Any>?) -> Unit,
)

val LocalBinding = compositionLocalOf<BindingContextValue?> { null }

@Composable
fun rememberBinding(): BindingContextValue {
    return LocalBinding.current
        ?: error("rememberBinding must be used within a BindingProvider.")
}

// --------------- Component ---------------

@Composable
fun BindingProvider(
    binding: BindingConfig,
    connectionState: ConnectionState = ConnectionState.DISCONNECTED,
    errorMessage: String? = null,
    showStatusBar: Boolean = true,
    statusBarPosition: String = "bottom",
    showSignals: Boolean = false,
    lastSync: Long? = null,
    accentColor: Color = MaterialTheme.colorScheme.primary,
    onInvoke: (suspend (String, Map<String, Any>?) -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val contextValue = remember(binding, connectionState) {
        BindingContextValue(
            binding = binding,
            connectionState = connectionState,
            readSignal = { name -> binding.signalMap[name] },
            invoke = { action, params -> onInvoke?.invoke(action, params) },
        )
    }

    CompositionLocalProvider(LocalBinding provides contextValue) {
        Column(modifier = modifier) {
            if (showStatusBar && statusBarPosition == "top") {
                BindingStatusBar(binding, connectionState, errorMessage, lastSync, accentColor)
            }

            if (showSignals && binding.signalMap.isNotEmpty()) {
                SignalDebugPanel(binding)
            }

            content()

            if (showStatusBar && statusBarPosition == "bottom") {
                BindingStatusBar(binding, connectionState, errorMessage, lastSync, accentColor)
            }
        }
    }
}

@Composable
private fun BindingStatusBar(
    binding: BindingConfig,
    state: ConnectionState,
    errorMessage: String?,
    lastSync: Long?,
    accentColor: Color,
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(
            text = state.icon,
            color = state.color,
            style = MaterialTheme.typography.labelSmall,
        )
        Text(
            text = binding.concept,
            color = accentColor,
            style = MaterialTheme.typography.labelSmall,
        )
        Text(
            text = "${binding.mode.icon} ${binding.mode.label}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        binding.endpoint?.let {
            Text(
                text = "\u2192 $it",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (state == ConnectionState.ERROR && errorMessage != null) {
            Text(
                text = errorMessage,
                color = Color(0xFFF44336),
                style = MaterialTheme.typography.labelSmall,
            )
        }
        Text(
            text = "[${binding.signalMap.size} signals]",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SignalDebugPanel(binding: BindingConfig) {
    Column {
        Text(
            text = "Signals:",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        binding.signalMap.forEach { (name, value) ->
            Row(modifier = Modifier.padding(start = 8.dp)) {
                Text(
                    text = "\u25B8 $name: ",
                    color = MaterialTheme.colorScheme.tertiary,
                    style = MaterialTheme.typography.labelSmall,
                )
                Text(
                    text = value.toString(),
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}
