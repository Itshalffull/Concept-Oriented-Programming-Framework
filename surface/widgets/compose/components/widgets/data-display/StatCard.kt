// ============================================================
// Clef Surface Compose Widget — StatCard
//
// Key performance indicator display showing a labelled numeric
// value with an optional trend indicator and description. Used
// in dashboards and summary views. Compose adaptation: Material 3
// Card with large headline value, label above, and colored trend
// row with arrow icon below.
// See widget spec: repertoire/widgets/data-display/stat-card.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.TrendingDown
import androidx.compose.material.icons.filled.TrendingFlat
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

/** Direction of the stat change. */
enum class ChangeType {
    Increase,
    Decrease,
    Neutral,
}

// --------------- Helpers ---------------

private fun ChangeType.icon(): ImageVector = when (this) {
    ChangeType.Increase -> Icons.Filled.TrendingUp
    ChangeType.Decrease -> Icons.Filled.TrendingDown
    ChangeType.Neutral -> Icons.Filled.TrendingFlat
}

private fun ChangeType.color(): Color = when (this) {
    ChangeType.Increase -> Color(0xFF4CAF50)
    ChangeType.Decrease -> Color(0xFFF44336)
    ChangeType.Neutral -> Color(0xFFFFC107)
}

// --------------- Component ---------------

/**
 * Dashboard stat card with large value, label, and trend indicator.
 *
 * @param label Descriptive label identifying the metric.
 * @param value Primary numeric or formatted value.
 * @param change Change delta or percentage string (e.g., "+12%").
 * @param changeType Direction of the change.
 * @param icon Optional leading icon.
 * @param modifier Modifier for the root card.
 */
@Composable
fun StatCard(
    label: String,
    value: String,
    change: String? = null,
    changeType: ChangeType = ChangeType.Neutral,
    icon: ImageVector? = null,
    modifier: Modifier = Modifier,
) {
    OutlinedCard(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Label row with optional icon
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (icon != null) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                }
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            // Value
            Text(
                text = value,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )

            // Change indicator
            if (change != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = changeType.icon(),
                        contentDescription = changeType.name,
                        tint = changeType.color(),
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = change,
                        style = MaterialTheme.typography.labelSmall,
                        color = changeType.color(),
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
        }
    }
}
