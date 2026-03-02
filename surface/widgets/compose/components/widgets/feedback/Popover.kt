// ============================================================
// Clef Surface Compose Widget — Popover
//
// Non-modal floating content panel anchored to a trigger
// element. Displays supplementary information or controls
// without blocking interaction with the rest of the page.
//
// Compose adaptation: Popup composable anchored to trigger
// content. Surface with elevation, optional title bar, and
// body content. Dismissible via outside click.
// See widget spec: repertoire/widgets/feedback/popover.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close

// --------------- Component ---------------

/**
 * Non-modal floating content panel anchored to a trigger element.
 *
 * @param open Whether the popover is visible.
 * @param title Optional heading labelling the popover content.
 * @param onClose Callback fired when the popover is dismissed.
 * @param popoverWidth Width of the popover surface.
 * @param modifier Modifier applied to the trigger Box.
 * @param popoverContent Content displayed inside the popover surface.
 * @param trigger Trigger element rendered inline (always visible).
 */
@Composable
fun ClefPopover(
    open: Boolean = false,
    title: String? = null,
    onClose: (() -> Unit)? = null,
    popoverWidth: Dp = 280.dp,
    modifier: Modifier = Modifier,
    popoverContent: @Composable (ColumnScope.() -> Unit)? = null,
    trigger: @Composable () -> Unit = {},
) {
    Box(modifier = modifier) {
        // Trigger content (always rendered)
        trigger()

        // Popover popup (rendered below trigger when open)
        if (open && popoverContent != null) {
            Popup(
                alignment = Alignment.TopStart,
                offset = IntOffset(0, 0),
                onDismissRequest = { onClose?.invoke() },
                properties = PopupProperties(
                    focusable = true,
                ),
            ) {
                Surface(
                    modifier = Modifier.width(popoverWidth),
                    shape = MaterialTheme.shapes.medium,
                    tonalElevation = 6.dp,
                    shadowElevation = 8.dp,
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                    ) {
                        // Title bar with close button
                        if (title != null) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Text(
                                    text = title,
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.weight(1f),
                                )

                                IconButton(
                                    onClick = { onClose?.invoke() },
                                    modifier = Modifier.size(24.dp),
                                ) {
                                    Icon(
                                        imageVector = Icons.Filled.Close,
                                        contentDescription = "Close popover",
                                        modifier = Modifier.size(16.dp),
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider()
                            Spacer(modifier = Modifier.height(12.dp))
                        }

                        // Body content
                        popoverContent()
                    }
                }
            }
        }
    }
}
