// ============================================================
// Clef Surface Compose Widget — StateMachineDiagram
//
// Visual state-and-transition diagram rendered on a Canvas
// composable. States display as circles with labels and
// transitions as arrows between them. The current state is
// highlighted.
//
// Adapts the state-machine-diagram.widget spec: anatomy (root,
// stateList, stateItem, stateName, stateFlags, transitionList,
// transitionItem, transitionFrom, transitionArrow, transitionTo,
// transitionLabel, addStateButton, addTransitionButton), states,
// and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class MachineState(
    val name: String,
    val initial: Boolean = false,
    val final: Boolean = false,
)

data class MachineTransition(
    val from: String,
    val to: String,
    val event: String,
)

// --------------- Component ---------------

/**
 * State machine diagram with state circles and transition arrows on Canvas.
 *
 * @param states List of states in the machine.
 * @param transitions List of transitions between states.
 * @param currentState Name of the currently active state.
 * @param canvasHeight Height of the drawing canvas.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun StateMachineDiagram(
    states: List<MachineState>,
    transitions: List<MachineTransition>,
    currentState: String? = null,
    canvasHeight: Dp = 200.dp,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        // Canvas diagram
        Canvas(modifier = Modifier.fillMaxWidth().height(canvasHeight)) {
            if (states.isEmpty()) return@Canvas

            val centerX = size.width / 2f
            val centerY = size.height / 2f
            val radius = minOf(centerX, centerY) * 0.65f
            val stateRadius = 28f

            // Position states in a circle
            val positions = states.mapIndexed { index, state ->
                val angle = (2 * Math.PI * index / states.size) - Math.PI / 2
                state.name to Offset(
                    centerX + radius * kotlin.math.cos(angle).toFloat(),
                    centerY + radius * kotlin.math.sin(angle).toFloat(),
                )
            }.toMap()

            // Draw transitions as arrows
            transitions.forEach { t ->
                val from = positions[t.from] ?: return@forEach
                val to = positions[t.to] ?: return@forEach

                // Shorten line to stop at circle edges
                val dx = to.x - from.x
                val dy = to.y - from.y
                val dist = kotlin.math.sqrt((dx * dx + dy * dy).toDouble()).toFloat()
                if (dist == 0f) return@forEach
                val nx = dx / dist
                val ny = dy / dist

                val start = Offset(from.x + nx * stateRadius, from.y + ny * stateRadius)
                val end = Offset(to.x - nx * stateRadius, to.y - ny * stateRadius)

                drawLine(
                    color = Color.Gray,
                    start = start,
                    end = end,
                    strokeWidth = 2f,
                )

                // Arrowhead
                val arrowLen = 10f
                val arrowAngle = Math.toRadians(25.0)
                val angle = kotlin.math.atan2(ny.toDouble(), nx.toDouble())
                drawLine(
                    color = Color.Gray,
                    start = end,
                    end = Offset(
                        end.x - arrowLen * kotlin.math.cos(angle - arrowAngle).toFloat(),
                        end.y - arrowLen * kotlin.math.sin(angle - arrowAngle).toFloat(),
                    ),
                    strokeWidth = 2f,
                )
                drawLine(
                    color = Color.Gray,
                    start = end,
                    end = Offset(
                        end.x - arrowLen * kotlin.math.cos(angle + arrowAngle).toFloat(),
                        end.y - arrowLen * kotlin.math.sin(angle + arrowAngle).toFloat(),
                    ),
                    strokeWidth = 2f,
                )
            }

            // Draw states as circles
            states.forEach { state ->
                val pos = positions[state.name] ?: return@forEach
                val isCurrent = state.name == currentState

                // Fill
                drawCircle(
                    color = if (isCurrent) Color(0xFF4CAF50) else Color(0xFFE0E0E0),
                    radius = stateRadius,
                    center = pos,
                )
                // Border
                drawCircle(
                    color = if (isCurrent) Color(0xFF2E7D32) else Color.Gray,
                    radius = stateRadius,
                    center = pos,
                    style = Stroke(width = if (state.final) 4f else 2f),
                )
                // Initial state marker (inner dot)
                if (state.initial) {
                    drawCircle(
                        color = Color.DarkGray,
                        radius = 4f,
                        center = Offset(pos.x - stateRadius - 8f, pos.y),
                    )
                    drawLine(
                        color = Color.DarkGray,
                        start = Offset(pos.x - stateRadius - 4f, pos.y),
                        end = Offset(pos.x - stateRadius, pos.y),
                        strokeWidth = 2f,
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Transition list
        Text(
            text = "Transitions:",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        LazyColumn {
            itemsIndexed(transitions) { _, t ->
                val fromIsCurrent = t.from == currentState
                Row(modifier = Modifier.padding(start = 8.dp, top = 2.dp)) {
                    Text(
                        text = "(${t.from})",
                        color = if (fromIsCurrent) Color(0xFF4CAF50) else MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = " \u2014",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = t.event,
                        color = MaterialTheme.colorScheme.tertiary,
                    )
                    Text(
                        text = "\u2192 ",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(text = "(${t.to})")
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Legend
        Row {
            Text(
                text = "\u25B8 initial   \u25A0 final   ",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "\u25CF current",
                style = MaterialTheme.typography.labelSmall,
                color = Color(0xFF4CAF50),
            )
        }
    }
}
