// ============================================================
// Clef Surface Compose Widget — Splitter
//
// Resizable pane divider for Jetpack Compose.
// Renders children side-by-side (horizontal) or stacked
// (vertical) with a draggable divider between them.
// Maps splitter.widget anatomy (root, panelBefore, handle,
// panelAfter) to Row/Column with draggable handle.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Resizable pane divider.
 *
 * @param orientation Layout orientation: "horizontal" or "vertical".
 * @param initialRatio Initial split ratio (0.0 to 1.0) for the first pane.
 * @param minRatio Minimum ratio for either pane.
 * @param modifier Modifier for the root layout.
 * @param firstPane Content for the first pane.
 * @param secondPane Content for the second pane.
 */
@Composable
fun Splitter(
    orientation: String = "horizontal",
    initialRatio: Float = 0.5f,
    minRatio: Float = 0.1f,
    modifier: Modifier = Modifier,
    firstPane: @Composable () -> Unit,
    secondPane: @Composable () -> Unit,
) {
    var ratio by remember { mutableFloatStateOf(initialRatio.coerceIn(minRatio, 1f - minRatio)) }
    val density = LocalDensity.current
    val isHorizontal = orientation == "horizontal"

    val handleColor = MaterialTheme.colorScheme.outlineVariant

    if (isHorizontal) {
        Row(modifier = modifier.fillMaxSize()) {
            // First pane
            Box(
                modifier = Modifier
                    .weight(ratio)
                    .fillMaxHeight(),
            ) {
                firstPane()
            }

            // Draggable handle
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .fillMaxHeight()
                    .background(handleColor)
                    .draggable(
                        orientation = Orientation.Horizontal,
                        state = rememberDraggableState { delta ->
                            val dpDelta = with(density) { delta.toDp() }
                            // Approximate: use a fraction of the drag
                            val change = dpDelta.value / 1000f
                            ratio = (ratio + change).coerceIn(minRatio, 1f - minRatio)
                        },
                    ),
            )

            // Second pane
            Box(
                modifier = Modifier
                    .weight(1f - ratio)
                    .fillMaxHeight(),
            ) {
                secondPane()
            }
        }
    } else {
        Column(modifier = modifier.fillMaxSize()) {
            // First pane
            Box(
                modifier = Modifier
                    .weight(ratio)
                    .fillMaxWidth(),
            ) {
                firstPane()
            }

            // Draggable handle
            Box(
                modifier = Modifier
                    .height(4.dp)
                    .fillMaxWidth()
                    .background(handleColor)
                    .draggable(
                        orientation = Orientation.Vertical,
                        state = rememberDraggableState { delta ->
                            val dpDelta = with(density) { delta.toDp() }
                            val change = dpDelta.value / 1000f
                            ratio = (ratio + change).coerceIn(minRatio, 1f - minRatio)
                        },
                    ),
            )

            // Second pane
            Box(
                modifier = Modifier
                    .weight(1f - ratio)
                    .fillMaxWidth(),
            ) {
                secondPane()
            }
        }
    }
}
