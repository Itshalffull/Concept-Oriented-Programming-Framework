// ============================================================
// Clef Surface Compose Widget — VisuallyHidden
//
// Renders content that is invisible to sighted users but
// accessible to screen readers and TalkBack. In Compose this
// is achieved by setting the size to zero and applying
// clearAndSetSemantics so the content description is still
// announced by accessibility services.
//
// Adapts the visually-hidden.widget spec: anatomy (root),
// states (static), and connect attributes (data-part, style)
// to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * VisuallyHidden composable that renders content invisible to sighted
 * users while remaining accessible to screen readers. The [text]
 * parameter is announced as the content description by accessibility
 * services.
 *
 * @param text Text content intended for screen readers.
 * @param modifier Compose modifier for the root element.
 * @param content Optional composable content (rendered at zero size).
 */
@Composable
fun VisuallyHidden(
    text: String? = null,
    modifier: Modifier = Modifier,
    content: (@Composable () -> Unit)? = null,
) {
    Box(
        modifier = modifier
            .size(0.dp)
            .alpha(0f)
            .then(
                if (text != null) {
                    Modifier.semantics { contentDescription = text }
                } else {
                    Modifier
                }
            ),
    ) {
        content?.invoke()
    }
}
