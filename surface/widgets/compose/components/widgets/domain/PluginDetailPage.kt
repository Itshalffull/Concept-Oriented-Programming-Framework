// ============================================================
// Clef Surface Compose Widget — PluginDetailPage
//
// Plugin marketplace detail page rendered as a Scaffold with
// plugin info sections: header with name/version/author,
// description, scrollable readme content, and action buttons
// for install/uninstall and enable/disable.
//
// Adapts the plugin-detail-page.widget spec: anatomy (root,
// hero, heroIcon, heroTitle, heroStats, installButton, tabs,
// descriptionTab, screenshotsTab, reviewsTab, changelogTab),
// states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Plugin marketplace detail page with header, description, readme, and actions.
 *
 * @param name Plugin display name.
 * @param version Plugin version string.
 * @param author Plugin author name.
 * @param description Short description of the plugin.
 * @param readme Full readme content.
 * @param installed Whether the plugin is installed.
 * @param enabled Whether the plugin is enabled.
 * @param onInstall Callback to install/uninstall the plugin.
 * @param onToggle Callback to toggle enable/disable.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun PluginDetailPage(
    name: String,
    version: String,
    author: String,
    description: String,
    readme: String? = null,
    installed: Boolean = false,
    enabled: Boolean = false,
    onInstall: () -> Unit = {},
    onToggle: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        tonalElevation = 1.dp,
    ) {
        Column(
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            // Header
            Text(
                text = name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "@$version",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "by $author",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (installed) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = if (enabled) "\u2713 Enabled" else "\u25CB Disabled",
                    style = MaterialTheme.typography.labelMedium,
                    color = if (enabled)
                        MaterialTheme.colorScheme.primary
                    else
                        MaterialTheme.colorScheme.tertiary,
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Description
            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
            )

            // Readme
            if (readme != null) {
                Spacer(modifier = Modifier.height(16.dp))
                Divider()
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "README",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(modifier = Modifier.height(8.dp))
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Text(
                        text = readme,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(12.dp),
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = onInstall,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (installed)
                            MaterialTheme.colorScheme.error
                        else
                            MaterialTheme.colorScheme.primary,
                    ),
                ) {
                    Text(text = if (installed) "Uninstall" else "Install")
                }

                if (installed) {
                    OutlinedButton(onClick = onToggle) {
                        Text(text = if (enabled) "Disable" else "Enable")
                    }
                }
            }
        }
    }
}
