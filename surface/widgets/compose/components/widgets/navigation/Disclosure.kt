// ============================================================
// Clef Surface Compose Widget — Disclosure
//
// Single expand/collapse toggle for Jetpack Compose.
// The simplest form of progressive disclosure: a clickable
// Row with indicator and AnimatedVisibility content panel.
// Maps disclosure.widget anatomy (root, trigger, indicator,
// content) to Column with clickable Row toggle.
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Single expand/collapse toggle.
 *
 * @param label Trigger label text.
 * @param open Controlled expanded state (null for internal state).
 * @param onToggle Callback when the disclosure is toggled.
 * @param modifier Modifier for the root layout.
 * @param content Content to display when expanded.
 */
@Composable
fun Disclosure(
    label: String,
    open: Boolean? = null,
    onToggle: ((Boolean) -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    var internalOpen by remember { mutableStateOf(open ?: false) }
    val isOpen = open ?: internalOpen

    Column(modifier = modifier.fillMaxWidth()) {
        // Trigger row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable {
                    val next = !isOpen
                    internalOpen = next
                    onToggle?.invoke(next)
                }
                .padding(vertical = 8.dp, horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Filled.ExpandMore,
                contentDescription = if (isOpen) "Collapse" else "Expand",
                modifier = Modifier.rotate(if (isOpen) 180f else 270f),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.padding(start = 8.dp),
            )
        }

        // Expandable content
        AnimatedVisibility(
            visible = isOpen,
            enter = expandVertically(),
            exit = shrinkVertically(),
        ) {
            Column(
                modifier = Modifier.padding(
                    start = 40.dp,
                    end = 16.dp,
                    bottom = 8.dp,
                ),
            ) {
                content()
            }
        }
    }
}
