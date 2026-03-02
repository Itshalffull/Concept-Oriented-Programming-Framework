// ============================================================
// Clef Surface Compose Widget — Presence
//
// Controls conditional rendering of children based on the
// present flag. Supports animated enter/exit transitions via
// AnimatedVisibility when present changes. ForceMount keeps
// content in the composition tree even when not visible.
//
// Adapts the presence.widget spec: anatomy (root), states
// (unmounted, mounting, mounted, unmounting), and connect
// attributes (data-part, data-state, data-present)
// to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.animation.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// --------------- Component ---------------

/**
 * Presence composable that conditionally renders its content with
 * optional enter/exit animations via [AnimatedVisibility].
 *
 * @param present Whether the content should be visible.
 * @param animateOnMount Whether to animate the initial appearance.
 * @param forceMount Force the content to remain in the composition tree.
 * @param modifier Compose modifier for the root element.
 * @param content Content to conditionally render.
 */
@Composable
fun Presence(
    present: Boolean = false,
    animateOnMount: Boolean = false,
    forceMount: Boolean = false,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    if (forceMount) {
        // Keep content in the composition tree regardless of present state.
        // Use AnimatedVisibility so it can fade in/out without unmounting.
        AnimatedVisibility(
            visible = present,
            modifier = modifier,
            enter = fadeIn() + expandVertically(),
            exit = fadeOut() + shrinkVertically(),
        ) {
            content()
        }
    } else if (present) {
        if (animateOnMount) {
            AnimatedVisibility(
                visible = true,
                modifier = modifier,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically(),
            ) {
                content()
            }
        } else {
            content()
        }
    }
    // When not present and not forceMount, render nothing.
}
