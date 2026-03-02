// ============================================================
// Clef Surface Compose Widget — DesignTokenProvider
//
// CompositionLocal provider that supplies resolved design tokens
// to descendant Compose components. Provides token lookup via
// Compose's ambient state system (CompositionLocal).
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// --------------- Context ---------------

data class DesignTokenContextValue(
    val theme: ResolvedTheme,
    val tokens: Map<String, String>,
    val getToken: (String) -> String?,
)

val LocalDesignTokens = compositionLocalOf<DesignTokenContextValue?> { null }

// --------------- Hook ---------------

@Composable
fun rememberDesignTokens(): DesignTokenContextValue {
    return LocalDesignTokens.current
        ?: error("rememberDesignTokens must be used within a DesignTokenProvider.")
}

// --------------- Component ---------------

@Composable
fun DesignTokenProvider(
    tokens: List<DesignTokenValue> = emptyList(),
    themes: List<ThemeConfig> = emptyList(),
    resolvedTheme: ResolvedTheme? = null,
    showBorder: Boolean = false,
    label: String = "tokens",
    content: @Composable () -> Unit,
) {
    val theme = remember(resolvedTheme, tokens, themes) {
        resolvedTheme ?: resolveTheme(tokens, themes)
    }

    val contextValue = remember(theme) {
        DesignTokenContextValue(
            theme = theme,
            tokens = theme.tokens,
            getToken = { name -> theme.tokens[name] },
        )
    }

    CompositionLocalProvider(LocalDesignTokens provides contextValue) {
        if (showBorder) {
            Column(
                modifier = Modifier
                    .border(1.dp, MaterialTheme.colorScheme.outline)
                    .padding(horizontal = 8.dp)
            ) {
                Text(
                    text = "[$label: ${theme.name}]",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.labelSmall,
                )
                content()
            }
        } else {
            Column {
                content()
            }
        }
    }
}
