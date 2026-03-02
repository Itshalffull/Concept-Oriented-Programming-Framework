// ============================================================
// Clef Surface Compose Widget — Accordion
//
// Vertically stacked collapsible sections for Jetpack Compose.
// Each section has a trigger heading and expandable content
// panel with AnimatedVisibility. Supports single or multiple
// expanded sections. Maps accordion.widget anatomy (root, item,
// trigger, indicator, content) to Column with clickable headers.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class AccordionItem(
    val id: String,
    val title: String,
    val content: String,
)

// --------------- Component ---------------

/**
 * Vertically stacked collapsible sections.
 *
 * @param items Array of collapsible sections.
 * @param multiple Allow multiple sections open simultaneously.
 * @param defaultOpen IDs of initially expanded sections.
 * @param onChange Callback when expanded sections change.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun Accordion(
    items: List<AccordionItem>,
    multiple: Boolean = false,
    defaultOpen: List<String> = emptyList(),
    onChange: ((List<String>) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var openIds by remember { mutableStateOf(defaultOpen.toSet()) }

    Column(modifier = modifier.fillMaxWidth()) {
        items.forEachIndexed { index, item ->
            val isOpen = item.id in openIds

            // Trigger row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        openIds = if (isOpen) {
                            val next = openIds - item.id
                            onChange?.invoke(next.toList())
                            next
                        } else {
                            val next = if (multiple) openIds + item.id else setOf(item.id)
                            onChange?.invoke(next.toList())
                            next
                        }
                    }
                    .padding(vertical = 12.dp, horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    imageVector = Icons.Filled.ExpandMore,
                    contentDescription = if (isOpen) "Collapse" else "Expand",
                    modifier = Modifier.rotate(if (isOpen) 180f else 0f),
                )
            }

            // Expandable content
            AnimatedVisibility(
                visible = isOpen,
                enter = expandVertically(),
                exit = shrinkVertically(),
            ) {
                Text(
                    text = item.content,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(
                        start = 16.dp,
                        end = 16.dp,
                        bottom = 12.dp,
                    ),
                )
            }

            if (index < items.lastIndex) {
                HorizontalDivider()
            }
        }
    }
}
