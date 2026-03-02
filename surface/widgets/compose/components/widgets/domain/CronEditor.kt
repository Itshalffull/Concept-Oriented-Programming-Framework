// ============================================================
// Clef Surface Compose Widget — CronEditor
//
// Visual cron expression builder rendered as a Row of TextField
// fields for the five cron parts (minute, hour, day, month,
// weekday) with a human-readable schedule summary below.
//
// Adapts the cron-editor.widget spec: anatomy (root, tabs,
// simpleEditor, frequencySelect, timeInput, daySelect,
// advancedEditor, cronInput, preview, nextRuns), states
// (simple, advanced), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

// --------------- Helpers ---------------

private val FIELD_LABELS = listOf("min", "hour", "day", "month", "weekday")

private fun describeCron(parts: List<String>): String {
    if (parts.size != 5) return "Invalid cron expression"

    val (min, hour, day, month, weekday) = parts

    if (parts.all { it == "*" }) return "Every minute"
    if (min != "*" && hour == "*" && day == "*" && month == "*" && weekday == "*") {
        return "At minute $min of every hour"
    }
    if (min != "*" && hour != "*" && day == "*" && month == "*" && weekday == "*") {
        return "Daily at $hour:${min.padStart(2, '0')}"
    }
    if (weekday != "*" && day == "*") {
        val days = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        val dayName = weekday.toIntOrNull()?.let { days.getOrNull(it) } ?: weekday
        return "Every $dayName at ${hour.ifEmpty { "*" }}:${min.ifEmpty { "*" }.padStart(2, '0')}"
    }
    if (day != "*" && month == "*") {
        return "Monthly on day $day at ${hour.ifEmpty { "*" }}:${min.ifEmpty { "*" }.padStart(2, '0')}"
    }

    return parts.joinToString(" ")
}

// --------------- Component ---------------

/**
 * Visual cron expression builder with five text fields and a summary.
 *
 * @param value Current cron expression string (space-separated).
 * @param onValueChange Callback when the cron expression changes.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun CronEditor(
    value: String,
    onValueChange: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val parts by remember(value) {
        derivedStateOf {
            val p = value.split(Regex("\\s+")).toMutableList()
            while (p.size < 5) p.add("*")
            p.take(5)
        }
    }

    val summary by remember(parts) {
        derivedStateOf { describeCron(parts) }
    }

    Column(modifier = modifier.padding(8.dp)) {
        // Field labels and inputs
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            FIELD_LABELS.forEachIndexed { index, label ->
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = parts.getOrElse(index) { "*" },
                        onValueChange = { newVal ->
                            val newParts = parts.toMutableList()
                            newParts[index] = newVal.ifEmpty { "*" }
                            onValueChange(newParts.joinToString(" "))
                        },
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(
                            textAlign = TextAlign.Center,
                        ),
                    )
                }
            }
        }

        // Human-readable summary
        Spacer(modifier = Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "\u23F0",
                style = MaterialTheme.typography.bodyMedium,
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = summary,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}
