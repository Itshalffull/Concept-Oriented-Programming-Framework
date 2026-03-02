// ============================================================
// Clef Surface Compose Widget — SignaturePad
//
// Freeform signature capture area using a Canvas with pointer
// event drawing. Users draw on the canvas by dragging, and a
// clear button resets the strokes. Displays a "Sign here" prompt
// when empty and a signed/unsigned status indicator.
//
// Adapts the signature-pad.widget spec: anatomy (root, canvas,
// clearButton, label), states (content, focus), and connect
// attributes to Compose rendering with Canvas pointer input.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

private data class StrokeLine(
    val points: List<Offset>,
)

// --------------- Component ---------------

/**
 * SignaturePad composable that provides a freeform drawing Canvas
 * for capturing signatures. Users draw by dragging on the canvas,
 * and a clear button resets the content.
 *
 * @param width Width of the signature area in dp.
 * @param height Height of the signature area in dp.
 * @param enabled Whether the pad is enabled for drawing.
 * @param label Visible label above the pad.
 * @param strokeColor Color of the drawn strokes.
 * @param strokeWidth Width of the drawn strokes.
 * @param onSign Callback when a signature is recorded (the pad goes from empty to drawn).
 * @param onClear Callback when the signature is cleared.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun SignaturePad(
    width: Int = 300,
    height: Int = 150,
    enabled: Boolean = true,
    label: String = "Signature",
    strokeColor: Color = MaterialTheme.colorScheme.onSurface,
    strokeWidth: Float = 3f,
    onSign: ((String) -> Unit)? = null,
    onClear: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var strokes by remember { mutableStateOf(listOf<StrokeLine>()) }
    var currentStroke by remember { mutableStateOf(listOf<Offset>()) }
    var hasSigned by remember { mutableStateOf(false) }

    val isSigned = strokes.isNotEmpty() || currentStroke.isNotEmpty()
    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // -- Label --
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
        )

        // -- Canvas area --
        Box(
            modifier = Modifier
                .width(width.dp)
                .height(height.dp)
                .border(
                    width = 1.dp,
                    color = if (enabled) {
                        MaterialTheme.colorScheme.outline
                    } else {
                        MaterialTheme.colorScheme.outline.copy(alpha = 0.38f)
                    },
                    shape = RoundedCornerShape(8.dp),
                ),
            contentAlignment = Alignment.Center,
        ) {
            Canvas(
                modifier = Modifier
                    .fillMaxSize()
                    .then(
                        if (enabled) {
                            Modifier.pointerInput(Unit) {
                                detectDragGestures(
                                    onDragStart = { offset ->
                                        currentStroke = listOf(offset)
                                    },
                                    onDrag = { change, _ ->
                                        change.consume()
                                        currentStroke = currentStroke + change.position
                                    },
                                    onDragEnd = {
                                        if (currentStroke.isNotEmpty()) {
                                            strokes = strokes + StrokeLine(currentStroke)
                                            currentStroke = emptyList()
                                            if (!hasSigned) {
                                                hasSigned = true
                                                onSign?.invoke("signature-${System.currentTimeMillis()}")
                                            }
                                        }
                                    },
                                    onDragCancel = {
                                        currentStroke = emptyList()
                                    },
                                )
                            }
                        } else {
                            Modifier
                        }
                    ),
            ) {
                val style = Stroke(
                    width = strokeWidth,
                    cap = StrokeCap.Round,
                    join = StrokeJoin.Round,
                )

                // Draw completed strokes
                for (stroke in strokes) {
                    if (stroke.points.size >= 2) {
                        val path = Path().apply {
                            moveTo(stroke.points[0].x, stroke.points[0].y)
                            for (i in 1 until stroke.points.size) {
                                lineTo(stroke.points[i].x, stroke.points[i].y)
                            }
                        }
                        drawPath(
                            path = path,
                            color = strokeColor.copy(alpha = disabledAlpha),
                            style = style,
                        )
                    }
                }

                // Draw current in-progress stroke
                if (currentStroke.size >= 2) {
                    val path = Path().apply {
                        moveTo(currentStroke[0].x, currentStroke[0].y)
                        for (i in 1 until currentStroke.size) {
                            lineTo(currentStroke[i].x, currentStroke[i].y)
                        }
                    }
                    drawPath(
                        path = path,
                        color = strokeColor.copy(alpha = disabledAlpha),
                        style = style,
                    )
                }
            }

            // -- Placeholder when empty --
            if (!isSigned) {
                Text(
                    text = "Sign here",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f),
                )
            }
        }

        // -- Controls --
        Row(
            modifier = Modifier.width(width.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = if (isSigned) "Signed" else "Not signed",
                style = MaterialTheme.typography.bodySmall,
                color = if (isSigned) {
                    MaterialTheme.colorScheme.primary.copy(alpha = disabledAlpha)
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha)
                },
            )

            OutlinedButton(
                onClick = {
                    strokes = emptyList()
                    currentStroke = emptyList()
                    hasSigned = false
                    onClear?.invoke()
                },
                enabled = enabled && isSigned,
            ) {
                Icon(
                    Icons.Filled.Clear,
                    contentDescription = "Clear signature",
                    modifier = Modifier.size(16.dp),
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text("Clear")
            }
        }
    }
}
