// ============================================================
// Clef Surface Compose Widget — StepIndicator
//
// Stepper and wizard progress indicator rendered as a
// Row or Column of numbered step circles connected by lines.
// Completed steps show a checkmark, the current step uses
// primary color, and pending steps appear dimmed.
//
// Adapts the step-indicator.widget spec: anatomy (root, step,
// stepNumber, stepLabel, stepDescription, connector), states
// (upcoming, current, completed), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Types ---------------

data class StepDef(
    val label: String,
    val status: String = "pending", // "completed", "current", "pending"
)

// --------------- Helpers ---------------

private fun statusColor(status: String): Color = when (status) {
    "completed" -> Color(0xFF4CAF50)
    "current" -> Color(0xFF6200EE)
    else -> Color(0xFFBDBDBD)
}

private fun statusIcon(status: String): String = when (status) {
    "completed" -> "\u2713"
    "current" -> "\u25CF"
    else -> ""
}

// --------------- Component ---------------

/**
 * Step progress indicator with numbered circles and connecting lines.
 *
 * @param steps Ordered list of steps with labels and statuses.
 * @param currentStep Index of the current step (0-based). Overrides individual statuses.
 * @param orientation "horizontal" or "vertical" layout.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun StepIndicator(
    steps: List<StepDef>,
    currentStep: Int? = null,
    orientation: String = "horizontal",
    modifier: Modifier = Modifier,
) {
    val resolvedSteps = steps.mapIndexed { index, step ->
        if (currentStep != null) {
            val status = when {
                index < currentStep -> "completed"
                index == currentStep -> "current"
                else -> "pending"
            }
            step.copy(status = status)
        } else step
    }

    if (orientation == "vertical") {
        Column(modifier = modifier.padding(8.dp)) {
            resolvedSteps.forEachIndexed { index, step ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Circle
                    val color = statusColor(step.status)
                    Canvas(modifier = Modifier.size(32.dp)) {
                        if (step.status == "completed") {
                            drawCircle(color = color)
                        } else if (step.status == "current") {
                            drawCircle(color = color)
                        } else {
                            drawCircle(color = color, style = Stroke(width = 2f))
                        }
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = step.label,
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = if (step.status == "current") FontWeight.Bold else FontWeight.Normal,
                        color = if (step.status == "pending")
                            MaterialTheme.colorScheme.onSurfaceVariant
                        else
                            MaterialTheme.colorScheme.onSurface,
                    )
                }
                // Connector
                if (index < resolvedSteps.lastIndex) {
                    Box(modifier = Modifier.padding(start = 15.dp)) {
                        Canvas(modifier = Modifier.size(2.dp, 20.dp)) {
                            drawLine(
                                color = Color.LightGray,
                                start = Offset(size.width / 2, 0f),
                                end = Offset(size.width / 2, size.height),
                                strokeWidth = 2f,
                            )
                        }
                    }
                }
            }
        }
    } else {
        // Horizontal layout
        Row(
            modifier = modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            resolvedSteps.forEachIndexed { index, step ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    val color = statusColor(step.status)
                    Canvas(modifier = Modifier.size(32.dp)) {
                        if (step.status == "pending") {
                            drawCircle(color = color, style = Stroke(width = 2f))
                        } else {
                            drawCircle(color = color)
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = step.label,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (step.status == "current") FontWeight.Bold else FontWeight.Normal,
                        color = if (step.status == "pending")
                            MaterialTheme.colorScheme.onSurfaceVariant
                        else
                            MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center,
                    )
                }
                // Connector line
                if (index < resolvedSteps.lastIndex) {
                    Canvas(modifier = Modifier.width(24.dp).height(2.dp).padding(top = 0.dp)) {
                        drawLine(
                            color = Color.LightGray,
                            start = Offset(0f, size.height / 2),
                            end = Offset(size.width, size.height / 2),
                            strokeWidth = 2f,
                        )
                    }
                }
            }
        }
    }
}
