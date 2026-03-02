// ============================================================
// Clef Surface Compose Widget — EmptyState
//
// Placeholder display shown when a data view contains no items.
// Provides a friendly visual with an optional icon, title,
// descriptive text, and call-to-action button. Compose
// adaptation: centered Column with icon, title Text, body Text,
// and Material 3 FilledTonalButton for the action.
// See widget spec: repertoire/widgets/data-display/empty-state.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class EmptyStateAction(
    val label: String,
    val onPress: () -> Unit,
)

// --------------- Component ---------------

/**
 * Placeholder display for empty data views with icon, message, and optional action.
 *
 * @param title Primary message explaining the empty state.
 * @param description Optional secondary text with guidance or context.
 * @param icon Optional icon displayed above the title.
 * @param action Optional call-to-action button.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun EmptyState(
    title: String,
    description: String? = null,
    icon: ImageVector? = null,
    action: EmptyStateAction? = null,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        // Icon
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Title
        Text(
            text = title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )

        // Description
        if (description != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }

        // Action button
        if (action != null) {
            Spacer(modifier = Modifier.height(24.dp))
            FilledTonalButton(onClick = action.onPress) {
                Text(text = action.label)
            }
        }
    }
}
