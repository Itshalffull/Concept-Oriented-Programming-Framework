// ============================================================
// Clef Surface Compose Widget — Sidebar
//
// Collapsible side panel with persistent navigation for
// Jetpack Compose. Uses Material 3 ModalNavigationDrawer or
// PermanentNavigationDrawer with NavigationDrawerItem for
// items. Supports full and collapsed modes, nested groups,
// and active indicators. Maps sidebar.widget anatomy (root,
// header, content, footer, toggleButton, group, item, etc.)
// to Material 3 drawer composables.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.PermanentDrawerSheet
import androidx.compose.material3.PermanentNavigationDrawer
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

// --------------- Types ---------------

data class SidebarItem(
    val id: String,
    val label: String,
    val icon: String? = null,
    val children: List<SidebarItem>? = null,
)

// --------------- Component ---------------

/**
 * Collapsible side panel with persistent navigation.
 *
 * @param items Navigation items.
 * @param collapsed Whether the sidebar uses a modal drawer.
 * @param activeId ID of the currently active item.
 * @param onNavigate Callback when a navigation item is selected.
 * @param onToggle Callback when the collapse toggle is triggered.
 * @param modifier Modifier for the root layout.
 * @param content Main content displayed beside the drawer.
 */
@Composable
fun Sidebar(
    items: List<SidebarItem>,
    collapsed: Boolean = false,
    activeId: String? = null,
    onNavigate: ((SidebarItem) -> Unit)? = null,
    onToggle: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var expandedGroups by remember { mutableStateOf(emptySet<String>()) }

    val drawerContent: @Composable () -> Unit = {
        Column(modifier = Modifier.padding(12.dp)) {
            items.forEach { item ->
                val isActive = item.id == activeId
                val hasChildren = !item.children.isNullOrEmpty()
                val isExpanded = item.id in expandedGroups

                NavigationDrawerItem(
                    label = { Text(text = item.label) },
                    selected = isActive,
                    onClick = {
                        if (hasChildren) {
                            expandedGroups = if (isExpanded) {
                                expandedGroups - item.id
                            } else {
                                expandedGroups + item.id
                            }
                        } else {
                            onNavigate?.invoke(item)
                        }
                    },
                    icon = {
                        Icon(
                            imageVector = Icons.Filled.Circle,
                            contentDescription = null,
                        )
                    },
                    badge = if (hasChildren) {
                        {
                            Icon(
                                imageVector = if (isExpanded) {
                                    Icons.Filled.ExpandLess
                                } else {
                                    Icons.Filled.ExpandMore
                                },
                                contentDescription = if (isExpanded) "Collapse" else "Expand",
                            )
                        }
                    } else null,
                )

                // Nested children
                if (hasChildren && isExpanded) {
                    item.children?.forEach { child ->
                        val isChildActive = child.id == activeId
                        NavigationDrawerItem(
                            label = { Text(text = child.label) },
                            selected = isChildActive,
                            onClick = { onNavigate?.invoke(child) },
                            modifier = Modifier.padding(start = 16.dp),
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            HorizontalDivider()

            if (onToggle != null) {
                IconButton(onClick = onToggle) {
                    Icon(
                        imageVector = Icons.Filled.Menu,
                        contentDescription = "Toggle sidebar",
                    )
                }
            }
        }
    }

    if (collapsed) {
        val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
        val scope = rememberCoroutineScope()

        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                ModalDrawerSheet { drawerContent() }
            },
            modifier = modifier,
        ) {
            content()
        }
    } else {
        PermanentNavigationDrawer(
            drawerContent = {
                PermanentDrawerSheet { drawerContent() }
            },
            modifier = modifier,
        ) {
            content()
        }
    }
}
