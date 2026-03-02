// ============================================================
// Clef Surface Compose Widget — WidgetMachine
//
// Compose headless component that runs a Clef Surface widget
// state machine. Displays the machine status, anatomy parts,
// available transitions, and context values. Maps keyboard/
// touch events to machine transitions.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// --------------- State Visual Mapping ---------------

private val STATE_ICONS = mapOf(
    "idle" to "\u25CB", "active" to "\u25CF", "loading" to "\u25D4",
    "disabled" to "\u25CC", "error" to "\u2716", "success" to "\u2714",
    "focused" to "\u25C9", "pressed" to "\u25A3", "hover" to "\u25CE",
    "open" to "\u25BD", "closed" to "\u25B7", "checked" to "\u2611",
    "unchecked" to "\u2610",
)

private val STATE_COLORS = mapOf(
    "idle" to Color.Gray, "active" to Color(0xFF4CAF50), "loading" to Color(0xFFFFC107),
    "disabled" to Color.Gray, "error" to Color(0xFFF44336), "success" to Color(0xFF4CAF50),
    "focused" to Color.Cyan, "pressed" to Color.Magenta, "hover" to Color.Cyan,
    "open" to Color(0xFF4CAF50), "closed" to Color.Gray, "checked" to Color(0xFF4CAF50),
    "unchecked" to Color.Gray,
)

// --------------- Types ---------------

data class WidgetMachineSpec(
    val name: String,
    val states: Map<String, MachineStateDef>,
    val anatomy: WidgetAnatomy,
)

data class MachineStateDef(
    val on: Map<String, String>? = null,
    val initial: Boolean = false,
)

data class WidgetAnatomy(
    val parts: List<String> = emptyList(),
    val slots: List<String> = emptyList(),
)

// --------------- Component ---------------

@Composable
fun WidgetMachine(
    spec: WidgetMachineSpec,
    initialState: String? = null,
    showStatus: Boolean = true,
    showTransitions: Boolean = false,
    showContext: Boolean = false,
    title: String? = null,
    accentColor: Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier,
    partContent: @Composable ((String) -> Unit)? = null,
) {
    val initial = initialState
        ?: spec.states.entries.firstOrNull { it.value.initial }?.key
        ?: spec.states.keys.firstOrNull()
        ?: "idle"

    var currentState by remember { mutableStateOf(initial) }
    val widgetTitle = title ?: spec.name
    val stateIcon = STATE_ICONS[currentState] ?: "\u25A1"
    val stateColor = STATE_COLORS[currentState] ?: Color.Gray

    Column(
        modifier = modifier
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(4.dp))
            .padding(8.dp)
    ) {
        // Title bar
        Row {
            Text(
                text = widgetTitle,
                style = MaterialTheme.typography.titleSmall,
                color = accentColor,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "$stateIcon $currentState",
                color = stateColor,
                style = MaterialTheme.typography.bodySmall,
            )
        }

        // Status: show all states with current highlighted
        if (showStatus) {
            Spacer(modifier = Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                spec.states.keys.forEach { state ->
                    val isActive = state == currentState
                    Text(
                        text = if (isActive) "[$state]" else state,
                        style = if (isActive) {
                            MaterialTheme.typography.labelMedium
                        } else {
                            MaterialTheme.typography.labelSmall
                        },
                        color = if (isActive) {
                            STATE_COLORS[state] ?: accentColor
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    )
                }
            }
        }

        // Available transitions
        if (showTransitions) {
            val stateDef = spec.states[currentState]
            stateDef?.on?.let { transitions ->
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Transitions:",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                transitions.forEach { (event, target) ->
                    Row(modifier = Modifier.padding(start = 8.dp)) {
                        Text(
                            text = event,
                            color = Color(0xFFFFC107),
                            style = MaterialTheme.typography.labelSmall,
                        )
                        Text(
                            text = " \u2192 ",
                            style = MaterialTheme.typography.labelSmall,
                        )
                        Text(
                            text = target,
                            color = Color.Cyan,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }
        }

        // Anatomy parts
        if (spec.anatomy.parts.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            spec.anatomy.parts.forEach { part ->
                if (partContent != null) {
                    partContent(part)
                } else {
                    Row {
                        Text(
                            text = "\u25B8 ",
                            color = accentColor,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            text = part,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        // Slots
        if (spec.anatomy.slots.isNotEmpty()) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Slots: ${spec.anatomy.slots.joinToString(", ")}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
