// ============================================================
// Clef Surface Compose Widget — NavigationMenu
//
// Top-level navigation bar for Jetpack Compose.
// Uses Material 3 NavigationBar with NavigationBarItem for
// horizontal layout, or NavigationRail with NavigationRailItem
// for vertical layout. Maps navigation-menu.widget anatomy
// (root, list, item, trigger, link, content, indicator,
// viewport) to Material 3 navigation composables.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Circle
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// --------------- Types ---------------

data class NavigationMenuItem(
    val id: String,
    val label: String,
    val href: String? = null,
    val children: List<NavigationMenuItem>? = null,
)

// --------------- Component ---------------

/**
 * Top-level navigation bar or rail.
 *
 * @param items Navigation items.
 * @param orientation Layout orientation.
 * @param activeId ID of the currently active item.
 * @param onNavigate Callback when navigation occurs.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun NavigationMenu(
    items: List<NavigationMenuItem>,
    orientation: String = "horizontal",
    activeId: String? = null,
    onNavigate: ((NavigationMenuItem) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    if (orientation == "vertical") {
        NavigationRail(modifier = modifier) {
            items.forEach { item ->
                val isActive = item.id == activeId

                NavigationRailItem(
                    selected = isActive,
                    onClick = { onNavigate?.invoke(item) },
                    icon = {
                        Icon(
                            imageVector = Icons.Filled.Circle,
                            contentDescription = item.label,
                        )
                    },
                    label = { Text(text = item.label) },
                )
            }
        }
    } else {
        NavigationBar(modifier = modifier) {
            items.forEach { item ->
                val isActive = item.id == activeId

                NavigationBarItem(
                    selected = isActive,
                    onClick = { onNavigate?.invoke(item) },
                    icon = {
                        Icon(
                            imageVector = Icons.Filled.Circle,
                            contentDescription = item.label,
                        )
                    },
                    label = { Text(text = item.label) },
                )
            }
        }
    }
}
