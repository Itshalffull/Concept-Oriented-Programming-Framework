// ============================================================
// Clef Surface Compose Widget — HoverCard
//
// Preview card that displays richer content (e.g., user
// profile, link preview, resource summary) when triggered.
// In Compose, the card is shown on long-press or pointer
// hover and is controlled via the `visible` prop.
//
// Compose adaptation: Card rendered inside a Popup anchored
// to the trigger composable. Non-modal, does not block other
// interaction. Elevated card with rounded shape.
// See widget spec: repertoire/widgets/feedback/hover-card.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties

// --------------- Component ---------------

/**
 * Preview card anchored to a trigger element, shown when visible.
 *
 * @param visible Whether the hover card is displayed.
 * @param onDismiss Callback fired when the hover card should be hidden.
 * @param modifier Modifier applied to the trigger Box.
 * @param cardContent Content displayed inside the hover card surface.
 * @param trigger Trigger element rendered inline (always visible).
 */
@Composable
fun HoverCard(
    visible: Boolean = false,
    onDismiss: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    cardContent: @Composable (ColumnScope.() -> Unit)? = null,
    trigger: @Composable () -> Unit = {},
) {
    Box(modifier = modifier) {
        // Trigger content (always rendered)
        trigger()

        // Hover card popup (rendered below trigger when visible)
        if (visible && cardContent != null) {
            Popup(
                alignment = Alignment.TopStart,
                offset = IntOffset(0, 0),
                onDismissRequest = { onDismiss?.invoke() },
                properties = PopupProperties(
                    focusable = false,
                ),
            ) {
                Card(
                    modifier = Modifier
                        .widthIn(min = 200.dp, max = 320.dp)
                        .padding(4.dp),
                    elevation = CardDefaults.cardElevation(
                        defaultElevation = 8.dp,
                    ),
                    shape = MaterialTheme.shapes.medium,
                ) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        content = cardContent,
                    )
                }
            }
        }
    }
}
