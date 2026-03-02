// ============================================================
// Clef Surface Compose Widget — DatePicker
//
// Calendar-based date selection control using a custom month
// grid with day cells, month/year navigation header, and
// day-of-week column labels. Highlights the selected date and
// today's date. Respects optional min/max date constraints.
//
// Adapts the date-picker.widget spec: anatomy (root, label,
// header, prevButton, nextButton, title, grid, row, cell),
// states (popover, view, focus, validation), and connect
// attributes to Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

// --------------- Helpers ---------------

private val DAY_LABELS = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")

private fun parseDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try {
        LocalDate.parse(value)
    } catch (_: Exception) {
        null
    }
}

// --------------- Component ---------------

/**
 * DatePicker composable that renders a month calendar grid with
 * navigation controls for month/year, day selection, and visual
 * feedback for the selected date and today.
 *
 * @param value Current selected date as ISO string (e.g. "2026-03-15").
 * @param minDate Minimum selectable date as ISO string.
 * @param maxDate Maximum selectable date as ISO string.
 * @param enabled Whether the picker is enabled.
 * @param onDateChange Callback when the selected date changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun DatePicker(
    value: String? = null,
    minDate: String? = null,
    maxDate: String? = null,
    enabled: Boolean = true,
    onDateChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val selectedDate = parseDate(value)
    val minD = parseDate(minDate)
    val maxD = parseDate(maxDate)
    val today = LocalDate.now()

    var viewMonth by remember {
        mutableStateOf(
            YearMonth.from(selectedDate ?: today)
        )
    }

    LaunchedEffect(value) {
        val parsed = parseDate(value)
        if (parsed != null) {
            viewMonth = YearMonth.from(parsed)
        }
    }

    val daysInMonth = viewMonth.lengthOfMonth()
    val firstDayOfWeek = viewMonth.atDay(1).dayOfWeek.value % 7 // Sunday = 0

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Header: month/year navigation --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = { viewMonth = viewMonth.minusMonths(1) },
                enabled = enabled,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                    contentDescription = "Previous month",
                )
            }

            Text(
                text = "${viewMonth.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} ${viewMonth.year}",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )

            IconButton(
                onClick = { viewMonth = viewMonth.plusMonths(1) },
                enabled = enabled,
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = "Next month",
                )
            }
        }

        // -- Day-of-week header --
        Row(modifier = Modifier.fillMaxWidth()) {
            DAY_LABELS.forEach { label ->
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // -- Calendar grid --
        val totalCells = firstDayOfWeek + daysInMonth
        val weeks = (totalCells + 6) / 7

        for (week in 0 until weeks) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (dayOfWeek in 0 until 7) {
                    val cellIndex = week * 7 + dayOfWeek
                    val dayNumber = cellIndex - firstDayOfWeek + 1

                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        // Empty cell
                        Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val cellDate = viewMonth.atDay(dayNumber)
                        val isSelected = cellDate == selectedDate
                        val isToday = cellDate == today
                        val outOfRange = (minD != null && cellDate < minD) ||
                            (maxD != null && cellDate > maxD)
                        val cellEnabled = enabled && !outOfRange

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(2.dp)
                                .clip(CircleShape)
                                .then(
                                    when {
                                        isSelected -> Modifier.background(
                                            MaterialTheme.colorScheme.primary
                                        )
                                        isToday -> Modifier.border(
                                            1.dp,
                                            MaterialTheme.colorScheme.primary,
                                            CircleShape,
                                        )
                                        else -> Modifier
                                    }
                                )
                                .clickable(enabled = cellEnabled) {
                                    onDateChange?.invoke(cellDate.toString())
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = dayNumber.toString(),
                                style = MaterialTheme.typography.bodySmall,
                                color = when {
                                    isSelected -> MaterialTheme.colorScheme.onPrimary
                                    outOfRange -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                                    !enabled -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                                    else -> MaterialTheme.colorScheme.onSurface
                                },
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }

        // -- Selected date footer --
        Text(
            text = "Selected: ${value ?: "none"}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            modifier = Modifier.padding(top = 8.dp),
        )
    }
}
