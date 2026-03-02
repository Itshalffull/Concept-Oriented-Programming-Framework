// ============================================================
// Clef Surface Compose Widget — AlertDialog
//
// Confirmation dialog that requires an explicit user action
// before it can be dismissed. Unlike a standard dialog,
// pressing the system back button does NOT close it -- the
// user must interact with a confirm or cancel action. Used for
// destructive operations, unsaved-changes guards, and critical
// confirmations.
//
// Compose adaptation: Material 3 AlertDialog with confirm and
// dismiss buttons. Dismiss-on-back-press disabled.
// See widget spec: repertoire/widgets/feedback/alert-dialog.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning

// --------------- Component ---------------

/**
 * Confirmation dialog requiring an explicit confirm or cancel
 * action before dismissal.
 *
 * @param open Whether the alert dialog is visible.
 * @param title Heading that labels the alert dialog.
 * @param description Text explaining the action and its consequences.
 * @param cancelLabel Label for the cancel action.
 * @param confirmLabel Label for the confirm action.
 * @param onCancel Callback fired when the user cancels.
 * @param onConfirm Callback fired when the user confirms.
 */
@Composable
fun ClefAlertDialog(
    open: Boolean = false,
    title: String? = null,
    description: String? = null,
    cancelLabel: String = "Cancel",
    confirmLabel: String = "Confirm",
    onCancel: (() -> Unit)? = null,
    onConfirm: (() -> Unit)? = null,
) {
    if (!open) return

    AlertDialog(
        onDismissRequest = {
            // Alert dialogs intentionally do not dismiss on
            // outside click or back press -- the user must
            // interact with an explicit action button.
        },
        icon = {
            Icon(
                imageVector = Icons.Filled.Warning,
                contentDescription = "Warning",
                tint = MaterialTheme.colorScheme.error,
            )
        },
        title = if (title != null) {
            { Text(text = title) }
        } else {
            null
        },
        text = if (description != null) {
            { Text(text = description) }
        } else {
            null
        },
        dismissButton = {
            TextButton(onClick = { onCancel?.invoke() }) {
                Text(text = cancelLabel)
            }
        },
        confirmButton = {
            Button(
                onClick = { onConfirm?.invoke() },
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error,
                ),
            ) {
                Text(text = confirmLabel)
            }
        },
    )
}
