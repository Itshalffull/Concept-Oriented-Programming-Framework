// ============================================================
// Clef Surface Compose Widget — PluginCard
//
// Marketplace plugin card displaying name, version, author,
// description, installed/enabled status, and action buttons.
// Renders as a Material 3 Card with icon area, plugin info,
// status badge, and install/toggle action buttons.
// Maps plugin-card.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Plugin card composable displaying plugin metadata with
 * install/uninstall and enable/disable action buttons.
 *
 * @param name Plugin display name.
 * @param description Short description of the plugin.
 * @param version Current version string.
 * @param author Plugin author or publisher.
 * @param installed Whether the plugin is installed.
 * @param enabled Whether the plugin is enabled (only meaningful if installed).
 * @param onInstall Callback to install or uninstall the plugin.
 * @param onToggle Callback to toggle enabled/disabled state.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun PluginCard(
    name: String,
    description: String,
    version: String,
    author: String,
    installed: Boolean,
    enabled: Boolean,
    onInstall: (() -> Unit)? = null,
    onToggle: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val statusText = when {
        !installed -> "Available"
        enabled -> "Enabled"
        else -> "Disabled"
    }

    val statusColor = when {
        !installed -> MaterialTheme.colorScheme.onSurfaceVariant
        enabled -> Color(0xFF4CAF50)
        else -> Color(0xFFFF9800)
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Name and Version
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "v$version",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            // Author
            Text(
                text = "by $author",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                style = MaterialTheme.typography.bodySmall,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Description
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Status Badge
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(text = "Status: ", style = MaterialTheme.typography.bodyMedium)
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = statusColor.copy(alpha = 0.15f),
                ) {
                    Text(
                        text = statusText,
                        color = statusColor,
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action Buttons
            Row {
                if (installed) {
                    OutlinedButton(
                        onClick = { onInstall?.invoke() },
                        colors = ButtonDefaults.outlinedButtonColors(
                            contentColor = MaterialTheme.colorScheme.error,
                        ),
                    ) {
                        Text("Uninstall")
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(onClick = { onToggle?.invoke() }) {
                        Text(if (enabled) "Disable" else "Enable")
                    }
                } else {
                    Button(onClick = { onInstall?.invoke() }) {
                        Text("Install")
                    }
                }
            }
        }
    }
}
