// ============================================================
// Clef Surface Compose Widget — Fieldset
//
// Form field grouping container with legend for Jetpack Compose.
// Renders a Column with an outlined border and a legend Text
// positioned at the top edge, mimicking HTML fieldset semantics.
// Maps fieldset.widget anatomy (root, legend, content,
// description) to Column with outline border and legend overlay.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Form field grouping container with legend.
 *
 * @param legend Legend heading for the field group.
 * @param disabled Whether the fieldset and all children are disabled.
 * @param modifier Modifier for the root layout.
 * @param content Grouped form fields.
 */
@Composable
fun Fieldset(
    legend: String,
    disabled: Boolean = false,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val borderColor = if (disabled) {
        MaterialTheme.colorScheme.outlineVariant
    } else {
        MaterialTheme.colorScheme.outline
    }

    Box(modifier = modifier.fillMaxWidth()) {
        // Bordered content area with top padding to make room for legend
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 8.dp)
                .border(
                    width = 1.dp,
                    color = borderColor,
                    shape = MaterialTheme.shapes.small,
                )
                .padding(16.dp)
                .alpha(if (disabled) 0.5f else 1f),
        ) {
            content()
        }

        // Legend text overlaying the top border
        Surface(
            color = MaterialTheme.colorScheme.surface,
            modifier = Modifier
                .offset(x = 12.dp, y = 0.dp),
        ) {
            Text(
                text = legend,
                style = MaterialTheme.typography.labelMedium,
                color = if (disabled) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.onSurface
                },
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}
