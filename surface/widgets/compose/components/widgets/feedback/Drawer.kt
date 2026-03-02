// ============================================================
// Clef Surface Compose Widget — Drawer
//
// Slide-in panel that overlays the page content. Functions as
// a modal surface with focus trapping. Supports placement on
// the start (left) or end (right) edge with configurable width.
//
// Compose adaptation: Material 3 ModalNavigationDrawer with
// ModalDrawerSheet. Title bar, close button, and body content.
// drawerState controls open/close transitions.
// See widget spec: repertoire/widgets/feedback/drawer.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import kotlinx.coroutines.launch

// --------------- Position ---------------

enum class DrawerPosition {
    Start,
    End,
}

// --------------- Component ---------------

/**
 * Modal slide-in panel overlaying the page content.
 *
 * @param open Whether the drawer is visible.
 * @param position Edge from which the drawer slides in.
 * @param title Title displayed in the drawer header.
 * @param onClose Callback fired when the drawer is closed.
 * @param drawerWidth Width of the drawer sheet.
 * @param modifier Modifier applied to the ModalNavigationDrawer.
 * @param drawerContent Composable content rendered inside the drawer body.
 * @param content Main page content rendered behind the drawer.
 */
@Composable
fun ClefDrawer(
    open: Boolean = false,
    position: DrawerPosition = DrawerPosition.End,
    title: String? = null,
    onClose: (() -> Unit)? = null,
    drawerWidth: Dp = 300.dp,
    modifier: Modifier = Modifier,
    drawerContent: @Composable (ColumnScope.() -> Unit)? = null,
    content: @Composable () -> Unit = {},
) {
    val drawerState = rememberDrawerState(
        initialValue = if (open) DrawerValue.Open else DrawerValue.Closed,
    )
    val scope = rememberCoroutineScope()

    // Synchronize external open state with drawerState
    LaunchedEffect(open) {
        if (open) {
            drawerState.open()
        } else {
            drawerState.close()
        }
    }

    // Notify parent when drawer closes via gesture/scrim tap
    LaunchedEffect(drawerState.currentValue) {
        if (drawerState.currentValue == DrawerValue.Closed && open) {
            onClose?.invoke()
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        modifier = modifier,
        gesturesEnabled = open,
        drawerContent = {
            ModalDrawerSheet(
                modifier = Modifier.width(drawerWidth),
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxHeight()
                        .padding(16.dp),
                ) {
                    // Header with title and close button
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        if (title != null) {
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleLarge,
                                modifier = Modifier.weight(1f),
                            )
                        } else {
                            Spacer(modifier = Modifier.weight(1f))
                        }

                        IconButton(
                            onClick = {
                                scope.launch { drawerState.close() }
                                onClose?.invoke()
                            },
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Close,
                                contentDescription = "Close drawer",
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    HorizontalDivider()
                    Spacer(modifier = Modifier.height(16.dp))

                    // Body content
                    if (drawerContent != null) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .weight(1f),
                            content = drawerContent,
                        )
                    }
                }
            }
        },
        content = content,
    )
}
