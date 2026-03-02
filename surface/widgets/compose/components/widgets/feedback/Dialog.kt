// ============================================================
// Clef Surface Compose Widget — Dialog
//
// Modal overlay that captures focus and blocks interaction with
// the underlying content until dismissed. Supports a title bar,
// description, arbitrary body content, and optional close-on-
// back-press behavior.
//
// Compose adaptation: Material 3 BasicAlertDialog (full custom
// layout) wrapped in a Surface with title, description, body
// content, and an optional close IconButton.
// See widget spec: repertoire/widgets/feedback/dialog.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.DialogProperties
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close

// --------------- Component ---------------

/**
 * Modal dialog overlay with title, description, and body content.
 *
 * @param open Whether the dialog is visible.
 * @param title Heading that labels the dialog.
 * @param description Supplementary text explaining the dialog purpose.
 * @param closeOnBackPress Whether pressing the system back button closes the dialog.
 * @param onClose Callback fired when the dialog is closed.
 * @param modifier Modifier applied to the dialog Surface.
 * @param content Composable content rendered inside the dialog body.
 */
@Composable
fun ClefDialog(
    open: Boolean = false,
    title: String? = null,
    description: String? = null,
    closeOnBackPress: Boolean = true,
    onClose: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable (ColumnScope.() -> Unit)? = null,
) {
    if (!open) return

    androidx.compose.ui.window.Dialog(
        onDismissRequest = {
            if (closeOnBackPress) {
                onClose?.invoke()
            }
        },
        properties = DialogProperties(
            dismissOnBackPress = closeOnBackPress,
            dismissOnClickOutside = closeOnBackPress,
        ),
    ) {
        Surface(
            modifier = modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 6.dp,
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
            ) {
                // Title bar with optional close button
                if (title != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(
                            text = title,
                            style = MaterialTheme.typography.headlineSmall,
                            modifier = Modifier.weight(1f),
                        )

                        if (closeOnBackPress) {
                            IconButton(
                                onClick = { onClose?.invoke() },
                                modifier = Modifier.size(24.dp),
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Close,
                                    contentDescription = "Close dialog",
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Description
                if (description != null) {
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Body content
                if (content != null) {
                    content()
                }
            }
        }
    }
}
