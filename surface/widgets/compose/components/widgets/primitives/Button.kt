// ============================================================
// Clef Surface Compose Widget — Button
//
// Generic action trigger rendered using Material 3 button
// composables. Supports filled, outline, text, and danger
// variants with disabled and loading states. A spinning
// indicator replaces the icon slot when loading.
//
// Adapts the button.widget spec: anatomy (root, label, icon,
// spinner), states (idle, hovered, focused, pressed, disabled,
// loading), and connect attributes (data-variant, data-size,
// data-state, role) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private fun paddingForSize(size: String): PaddingValues = when (size) {
    "sm" -> PaddingValues(horizontal = 8.dp, vertical = 4.dp)
    "lg" -> PaddingValues(horizontal = 24.dp, vertical = 12.dp)
    else -> PaddingValues(horizontal = 16.dp, vertical = 8.dp) // md
}

// --------------- Component ---------------

/**
 * Button composable that renders an action trigger with Material 3
 * styling, supporting multiple visual variants and a loading state.
 *
 * @param variant Visual variant: "filled", "outline", "text", or "danger".
 * @param size Size controlling padding: "sm", "md", or "lg".
 * @param disabled Whether the button is disabled.
 * @param loading Whether the button shows a loading spinner.
 * @param onClick Callback when the button is pressed.
 * @param modifier Compose modifier for the root element.
 * @param content Slot for the button label content.
 */
@Composable
fun Button(
    variant: String = "filled",
    size: String = "md",
    disabled: Boolean = false,
    loading: Boolean = false,
    onClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable RowScope.() -> Unit,
) {
    val isEnabled = !disabled && !loading
    val contentPadding = paddingForSize(size)

    val dangerColors = ButtonDefaults.buttonColors(
        containerColor = MaterialTheme.colorScheme.error,
        contentColor = MaterialTheme.colorScheme.onError,
        disabledContainerColor = MaterialTheme.colorScheme.error.copy(alpha = 0.38f),
        disabledContentColor = MaterialTheme.colorScheme.onError.copy(alpha = 0.38f),
    )

    when (variant) {
        "outline" -> OutlinedButton(
            onClick = { onClick?.invoke() },
            enabled = isEnabled,
            contentPadding = contentPadding,
            modifier = modifier,
        ) {
            LoadingWrapper(loading = loading, content = content)
        }

        "text" -> TextButton(
            onClick = { onClick?.invoke() },
            enabled = isEnabled,
            contentPadding = contentPadding,
            modifier = modifier,
        ) {
            LoadingWrapper(loading = loading, content = content)
        }

        "danger" -> Button(
            onClick = { onClick?.invoke() },
            enabled = isEnabled,
            colors = dangerColors,
            contentPadding = contentPadding,
            modifier = modifier,
        ) {
            LoadingWrapper(loading = loading, content = content)
        }

        else -> Button(
            onClick = { onClick?.invoke() },
            enabled = isEnabled,
            contentPadding = contentPadding,
            modifier = modifier,
        ) {
            LoadingWrapper(loading = loading, content = content)
        }
    }
}

@Composable
private fun RowScope.LoadingWrapper(
    loading: Boolean,
    content: @Composable RowScope.() -> Unit,
) {
    if (loading) {
        CircularProgressIndicator(
            modifier = Modifier.size(16.dp),
            strokeWidth = 2.dp,
            color = LocalContentColor.current,
        )
        Spacer(modifier = Modifier.width(8.dp))
    }
    content()
}
