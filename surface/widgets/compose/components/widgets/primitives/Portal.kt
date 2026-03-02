// ============================================================
// Clef Surface Compose Widget — Portal
//
// In DOM environments, a portal renders children into a
// different location in the tree to escape clipping and
// stacking contexts. In Compose, overlays are typically
// handled via Popup or Dialog composables. This widget
// wraps content in a Popup when enabled, rendering inline
// otherwise.
//
// Adapts the portal.widget spec: anatomy (root), states
// (unmounted, mounted), and connect attributes (data-part,
// data-portal, data-state) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.window.Popup

// --------------- Component ---------------

/**
 * Portal composable that renders children in an overlay Popup layer
 * when enabled, bypassing the parent layout's clipping bounds.
 * When [disabled] is true, children are rendered inline.
 *
 * @param disabled Whether the portal is disabled (renders inline).
 * @param modifier Compose modifier for the root element.
 * @param content Content to render through the portal.
 */
@Composable
fun Portal(
    disabled: Boolean = false,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    if (disabled) {
        // Render children directly in place
        content()
    } else {
        // Render in an overlay layer using Popup
        Popup {
            content()
        }
    }
}
