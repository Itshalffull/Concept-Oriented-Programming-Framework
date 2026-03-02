// ============================================================
// Clef Surface Compose Widget — Toast
//
// Ephemeral notification that appears briefly to communicate
// the result of an action, a system event, or a background
// process. Automatically dismisses after a configurable
// duration. Supports info, success, warning, and error
// variants with optional action button.
//
// Compose adaptation: Snackbar rendered via SnackbarHost.
// Variant expressed through icon and container color. Optional
// action wired to SnackbarResult. Auto-dismiss via duration.
// See widget spec: repertoire/widgets/feedback/toast.widget
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

// --------------- Variant Configuration ---------------

enum class ToastVariant(
    val icon: ImageVector,
    val tint: Color,
    val containerColor: Color,
) {
    Info(
        icon = Icons.Filled.Info,
        tint = Color.White,
        containerColor = Color(0xFF1976D2),
    ),
    Success(
        icon = Icons.Filled.CheckCircle,
        tint = Color.White,
        containerColor = Color(0xFF388E3C),
    ),
    Warning(
        icon = Icons.Filled.Warning,
        tint = Color.White,
        containerColor = Color(0xFFF57C00),
    ),
    Error(
        icon = Icons.Filled.Error,
        tint = Color.White,
        containerColor = Color(0xFFD32F2F),
    ),
}

// --------------- Types ---------------

/**
 * Action button configuration for a [ClefToast].
 *
 * @property label Label for the action button.
 * @property onAction Callback fired when the action is activated.
 */
data class ToastAction(
    val label: String,
    val onAction: () -> Unit,
)

// --------------- Component ---------------

/**
 * Ephemeral notification snackbar with variant icon, title,
 * optional description, and optional action.
 *
 * This composable renders a custom Snackbar. For auto-dismiss
 * lifecycle management, use [ClefToastManager].
 *
 * @param variant Visual variant controlling icon and color.
 * @param title Primary notification message.
 * @param description Optional secondary detail text.
 * @param action Optional action button configuration.
 * @param onDismiss Callback fired when the toast is dismissed.
 * @param modifier Modifier applied to the root Snackbar.
 */
@Composable
fun ClefToast(
    variant: ToastVariant = ToastVariant.Info,
    title: String = "",
    description: String? = null,
    action: ToastAction? = null,
    onDismiss: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Snackbar(
        modifier = modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        containerColor = variant.containerColor,
        contentColor = variant.tint,
        action = if (action != null) {
            {
                TextButton(
                    onClick = action.onAction,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = variant.tint,
                    ),
                ) {
                    Text(text = action.label)
                }
            }
        } else {
            null
        },
        dismissAction = if (onDismiss != null) {
            {
                TextButton(
                    onClick = onDismiss,
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = variant.tint,
                    ),
                ) {
                    Text(text = "\u2715")
                }
            }
        } else {
            null
        },
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = variant.icon,
                contentDescription = variant.name,
                modifier = Modifier.size(20.dp),
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                )

                if (description != null) {
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}
