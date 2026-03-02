// ============================================================
// Clef Surface Compose Widget — Alert
//
// Inline, persistent status message that communicates important
// information within the layout. Unlike a toast, an alert does
// not auto-dismiss -- it remains visible until the user
// explicitly closes it (when closable) or until the triggering
// condition is resolved.
//
// Compose adaptation: Card with variant-colored leading icon,
// title, optional description, and optional close IconButton.
// See widget spec: repertoire/widgets/feedback/alert.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close

// --------------- Variant Configuration ---------------

enum class AlertVariant(
    val icon: ImageVector,
    val tint: Color,
    val containerColor: Color,
) {
    Info(
        icon = Icons.Filled.Info,
        tint = Color(0xFF1976D2),
        containerColor = Color(0xFFE3F2FD),
    ),
    Warning(
        icon = Icons.Filled.Warning,
        tint = Color(0xFFF57C00),
        containerColor = Color(0xFFFFF3E0),
    ),
    Error(
        icon = Icons.Filled.Error,
        tint = Color(0xFFD32F2F),
        containerColor = Color(0xFFFFEBEE),
    ),
    Success(
        icon = Icons.Filled.CheckCircle,
        tint = Color(0xFF388E3C),
        containerColor = Color(0xFFE8F5E9),
    ),
}

// --------------- Component ---------------

/**
 * Inline, persistent status message with icon, title, optional
 * description, and an optional close button.
 *
 * @param variant Visual variant controlling icon, colors, and semantics.
 * @param title Primary alert message.
 * @param description Optional secondary detail or guidance text.
 * @param closable Whether the alert can be dismissed by the user.
 * @param onClose Callback fired when the alert is dismissed.
 * @param modifier Modifier applied to the root Card.
 * @param content Additional composable content rendered inside the alert body.
 */
@Composable
fun Alert(
    variant: AlertVariant = AlertVariant.Info,
    title: String? = null,
    description: String? = null,
    closable: Boolean = false,
    onClose: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable (ColumnScope.() -> Unit)? = null,
) {
    var dismissed by remember { mutableStateOf(false) }

    if (dismissed) return

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = variant.containerColor,
        ),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
        ) {
            // Title row with icon and optional close button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    imageVector = variant.icon,
                    contentDescription = variant.name,
                    tint = variant.tint,
                    modifier = Modifier.size(20.dp),
                )

                Spacer(modifier = Modifier.width(12.dp))

                if (title != null) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleSmall,
                        color = variant.tint,
                        modifier = Modifier.weight(1f),
                    )
                } else {
                    Spacer(modifier = Modifier.weight(1f))
                }

                if (closable) {
                    IconButton(
                        onClick = {
                            dismissed = true
                            onClose?.invoke()
                        },
                        modifier = Modifier.size(24.dp),
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Close,
                            contentDescription = "Dismiss",
                            modifier = Modifier.size(16.dp),
                        )
                    }
                }
            }

            // Description
            if (description != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(start = 32.dp),
                )
            }

            // Additional children
            if (content != null) {
                Spacer(modifier = Modifier.height(8.dp))
                Column(
                    modifier = Modifier.padding(start = 32.dp),
                    content = content,
                )
            }
        }
    }
}
