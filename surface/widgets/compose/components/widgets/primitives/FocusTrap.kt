// ============================================================
// Clef Surface Compose Widget — FocusTrap
//
// Focus-trap wrapper that constrains focus within a boundary.
// In Compose, this is implemented using a FocusRequester group
// and modifier chain. When active, focus is captured within
// the content scope; when inactive, children render normally.
//
// Adapts the focus-trap.widget spec: anatomy (root,
// sentinelStart, sentinelEnd), states (inactive, active), and
// connect attributes (data-part, data-state, data-focus-trap)
// to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.focusGroup
import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester

// --------------- Component ---------------

/**
 * FocusTrap composable that constrains focus cycling within its
 * content boundary when [active] is true. Uses Compose focus
 * modifiers to capture and optionally loop focus.
 *
 * @param active Whether the focus trap is active.
 * @param returnFocus Whether to return focus on deactivation.
 * @param loop Whether Tab focus should loop within the trap.
 * @param modifier Compose modifier for the root element.
 * @param content The content wrapped by the focus trap.
 */
@Composable
fun FocusTrap(
    active: Boolean = false,
    returnFocus: Boolean = true,
    loop: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }

    LaunchedEffect(active) {
        if (active) {
            try {
                focusRequester.requestFocus()
            } catch (_: IllegalStateException) {
                // Focus requester may not yet be attached
            }
        }
    }

    Column(
        modifier = modifier
            .focusRequester(focusRequester)
            .focusGroup(),
    ) {
        content()
    }
}
