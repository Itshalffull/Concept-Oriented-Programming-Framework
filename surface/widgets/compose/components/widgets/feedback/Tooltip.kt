// ============================================================
// Clef Surface Compose Widget — Tooltip
//
// Lightweight floating label that provides supplementary
// descriptive text for a trigger element. Shown on long-press
// or pointer hover. Tooltips are non-interactive -- they
// contain no focusable elements.
//
// Compose adaptation: Material 3 PlainTooltip wrapped in a
// TooltipBox with a TooltipState. Supports top and bottom
// placement via TooltipDefaults.
// See widget spec: repertoire/widgets/feedback/tooltip.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier

// --------------- Component ---------------

/**
 * Lightweight floating label providing supplementary descriptive text.
 *
 * @param content Descriptive text displayed in the tooltip.
 * @param modifier Modifier applied to the TooltipBox.
 * @param trigger Trigger element that anchors the tooltip.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClefTooltip(
    content: String,
    modifier: Modifier = Modifier,
    trigger: @Composable () -> Unit = {},
) {
    val tooltipState = rememberTooltipState()

    TooltipBox(
        positionProvider = TooltipDefaults.rememberPlainTooltipPositionProvider(),
        tooltip = {
            PlainTooltip {
                Text(text = content)
            }
        },
        state = tooltipState,
        modifier = modifier,
    ) {
        trigger()
    }
}

/**
 * Rich tooltip variant with title and descriptive body text.
 *
 * @param title Heading text displayed prominently in the tooltip.
 * @param description Body text with additional details.
 * @param actionLabel Optional action label rendered as a clickable text button.
 * @param onAction Callback fired when the action is activated.
 * @param modifier Modifier applied to the TooltipBox.
 * @param trigger Trigger element that anchors the tooltip.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClefRichTooltip(
    title: String,
    description: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    trigger: @Composable () -> Unit = {},
) {
    val tooltipState = rememberTooltipState(isPersistent = actionLabel != null)

    TooltipBox(
        positionProvider = TooltipDefaults.rememberRichTooltipPositionProvider(),
        tooltip = {
            RichTooltip(
                title = { Text(text = title) },
                action = if (actionLabel != null && onAction != null) {
                    {
                        TextButton(onClick = onAction) {
                            Text(text = actionLabel)
                        }
                    }
                } else {
                    null
                },
            ) {
                Text(text = description)
            }
        },
        state = tooltipState,
        modifier = modifier,
    ) {
        trigger()
    }
}
