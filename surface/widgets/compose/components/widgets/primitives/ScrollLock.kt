// ============================================================
// Clef Surface Compose Widget — ScrollLock
//
// Prevents parent-level scrolling when active. In Compose,
// scrolling is controlled by scroll modifiers on containers,
// so this component uses a nested scroll connection to
// intercept and consume scroll events when locked. When
// inactive, children are rendered without interception.
//
// Adapts the scroll-lock.widget spec: anatomy (root), states
// (unlocked, locked), and connect attributes (data-part,
// data-state, data-scroll-lock) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.nestedscroll.NestedScrollConnection
import androidx.compose.ui.input.nestedscroll.NestedScrollSource
import androidx.compose.ui.input.nestedscroll.nestedScroll

// --------------- Component ---------------

/**
 * ScrollLock composable that intercepts and consumes scroll events
 * when [active] is true, preventing parent containers from scrolling.
 * When inactive, renders as a transparent wrapper.
 *
 * @param active Whether the scroll lock is active.
 * @param modifier Compose modifier for the root element.
 * @param content Optional content rendered within the scroll-lock boundary.
 */
@Composable
fun ScrollLock(
    active: Boolean = false,
    modifier: Modifier = Modifier,
    content: (@Composable () -> Unit)? = null,
) {
    if (!active) {
        // Unlocked — render content directly without interception
        if (content != null) {
            Box(modifier = modifier) {
                content()
            }
        }
        return
    }

    // Locked — consume all scroll deltas to prevent parent scrolling
    val consumeAllConnection = remember {
        object : NestedScrollConnection {
            override fun onPreScroll(
                available: Offset,
                source: NestedScrollSource,
            ): Offset = available // Consume all scroll events
        }
    }

    Box(
        modifier = modifier.nestedScroll(consumeAllConnection),
    ) {
        content?.invoke()
    }
}
