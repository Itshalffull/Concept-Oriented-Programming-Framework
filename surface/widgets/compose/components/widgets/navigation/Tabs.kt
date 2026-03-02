// ============================================================
// Clef Surface Compose Widget — Tabs
//
// Tabbed content switcher for Jetpack Compose.
// Uses Material 3 TabRow with Tab composables for the tab strip
// and renders content below for the selected tab. Maps tabs.widget
// anatomy (root, list, trigger, content, indicator) to
// Material 3 TabRow and Tab composables.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class TabItem(
    val id: String,
    val label: String,
    val disabled: Boolean = false,
)

// --------------- Component ---------------

/**
 * Tabbed content switcher with Material 3 TabRow.
 *
 * @param tabs Tab definitions.
 * @param activeId ID of the currently active tab.
 * @param onChange Callback when the active tab changes.
 * @param modifier Modifier for the root layout.
 * @param content Content panel rendered below the tab strip.
 */
@Composable
fun Tabs(
    tabs: List<TabItem>,
    activeId: String? = null,
    onChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: (@Composable () -> Unit)? = null,
) {
    val selectedIndex = tabs.indexOfFirst { it.id == activeId }.coerceAtLeast(0)

    Column(modifier = modifier.fillMaxWidth()) {
        // Tab strip
        TabRow(selectedTabIndex = selectedIndex) {
            tabs.forEachIndexed { index, tab ->
                Tab(
                    selected = index == selectedIndex,
                    onClick = {
                        if (!tab.disabled) {
                            onChange?.invoke(tab.id)
                        }
                    },
                    enabled = !tab.disabled,
                    text = {
                        Text(
                            text = tab.label,
                            color = if (tab.disabled) {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                        )
                    },
                )
            }
        }

        // Content panel
        if (content != null) {
            Column(modifier = Modifier.padding(top = 16.dp)) {
                content()
            }
        }
    }
}
