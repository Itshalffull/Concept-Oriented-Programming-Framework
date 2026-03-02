// ============================================================
// Clef Surface Compose Widget — Spinner
//
// Indeterminate loading indicator rendered with Material 3
// CircularProgressIndicator. An optional label is displayed
// alongside the spinner. Size affects the indicator diameter
// and stroke width.
//
// Adapts the spinner.widget spec: anatomy (root, track,
// indicator, label), states (spinning), and connect attributes
// (data-part, data-size, role, aria-busy, aria-label)
// to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private data class SpinnerConfig(val sizeDp: Dp, val strokeWidth: Dp)

private fun configForSize(size: String): SpinnerConfig = when (size) {
    "sm" -> SpinnerConfig(16.dp, 2.dp)
    "lg" -> SpinnerConfig(48.dp, 4.dp)
    else -> SpinnerConfig(24.dp, 3.dp) // md
}

// --------------- Component ---------------

/**
 * Spinner composable that renders an indeterminate circular progress
 * indicator with an optional text label alongside.
 *
 * @param size Size of the spinner: "sm", "md", or "lg".
 * @param label Optional text label displayed next to the spinner.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Spinner(
    size: String = "md",
    label: String? = null,
    modifier: Modifier = Modifier,
) {
    val config = configForSize(size)

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(config.sizeDp),
            strokeWidth = config.strokeWidth,
            color = MaterialTheme.colorScheme.primary,
        )

        if (label != null) {
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
        }
    }
}
