// ============================================================
// Clef Surface Compose Widget — DateRangePicker
//
// Dual-calendar date range selection control. Renders two
// side-by-side month grids with visual range highlighting,
// start/end selection toggle, and month navigation. Cells
// within the selected range are tinted, and range endpoints
// are accented.
//
// Adapts the date-range-picker.widget spec: anatomy (root,
// startInput, endInput, gridStart, gridEnd, header, cell),
// states (popover, selection, hover, focus), and connect
// attributes to Compose rendering with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.TextStyle
import java.util.Locale

// --------------- Types ---------------

data class DateRange(
    val startDate: String,
    val endDate: String,
)

// --------------- Helpers ---------------

private val DAY_LABELS = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")

private fun parseLocalDate(value: String?): LocalDate? {
    if (value.isNullOrBlank()) return null
    return try { LocalDate.parse(value) } catch (_: Exception) { null }
}

// --------------- Mini Calendar ---------------

@Composable
private fun MiniCalendar(
    yearMonth: YearMonth,
    selectedStart: LocalDate?,
    selectedEnd: LocalDate?,
    minDate: LocalDate?,
    maxDate: LocalDate?,
    enabled: Boolean,
    onDayClick: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    val daysInMonth = yearMonth.lengthOfMonth()
    val firstDayOfWeek = yearMonth.atDay(1).dayOfWeek.value % 7

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(2.dp)) {
        // Month/year header
        Text(
            text = "${yearMonth.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())} ${yearMonth.year}",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center,
        )

        // Day-of-week labels
        Row(modifier = Modifier.fillMaxWidth()) {
            DAY_LABELS.forEach { label ->
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Day grid
        val totalCells = firstDayOfWeek + daysInMonth
        val weeks = (totalCells + 6) / 7

        for (week in 0 until weeks) {
            Row(modifier = Modifier.fillMaxWidth()) {
                for (dow in 0 until 7) {
                    val cellIndex = week * 7 + dow
                    val dayNumber = cellIndex - firstDayOfWeek + 1

                    if (dayNumber < 1 || dayNumber > daysInMonth) {
                        Spacer(modifier = Modifier.weight(1f).aspectRatio(1f))
                    } else {
                        val cellDate = yearMonth.atDay(dayNumber)
                        val isStart = cellDate == selectedStart
                        val isEnd = cellDate == selectedEnd
                        val isEndpoint = isStart || isEnd
                        val inRange = selectedStart != null && selectedEnd != null &&
                            cellDate > selectedStart && cellDate < selectedEnd
                        val outOfRange = (minDate != null && cellDate < minDate) ||
                            (maxDate != null && cellDate > maxDate)
                        val cellEnabled = enabled && !outOfRange

                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .aspectRatio(1f)
                                .padding(1.dp)
                                .clip(CircleShape)
                                .then(
                                    when {
                                        isEndpoint -> Modifier.background(
                                            MaterialTheme.colorScheme.primary
                                        )
                                        inRange -> Modifier.background(
                                            MaterialTheme.colorScheme.primary.copy(alpha = 0.15f)
                                        )
                                        else -> Modifier
                                    }
                                )
                                .clickable(enabled = cellEnabled) {
                                    onDayClick(cellDate)
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = dayNumber.toString(),
                                style = MaterialTheme.typography.bodySmall,
                                color = when {
                                    isEndpoint -> MaterialTheme.colorScheme.onPrimary
                                    outOfRange -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                                    inRange -> MaterialTheme.colorScheme.primary
                                    else -> MaterialTheme.colorScheme.onSurface
                                },
                                textAlign = TextAlign.Center,
                            )
                        }
                    }
                }
            }
        }
    }
}

// --------------- Component ---------------

/**
 * DateRangePicker composable that renders two side-by-side month
 * calendars for selecting a start and end date. Visual range
 * highlighting shows the span between the two dates.
 *
 * @param startDate Start date as ISO string.
 * @param endDate End date as ISO string.
 * @param minDate Minimum selectable date as ISO string.
 * @param maxDate Maximum selectable date as ISO string.
 * @param enabled Whether the picker is enabled.
 * @param onRangeChange Callback when the date range changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun DateRangePicker(
    startDate: String? = null,
    endDate: String? = null,
    minDate: String? = null,
    maxDate: String? = null,
    enabled: Boolean = true,
    onRangeChange: ((DateRange) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    val startD = parseLocalDate(startDate)
    val endD = parseLocalDate(endDate)
    val minD = parseLocalDate(minDate)
    val maxD = parseLocalDate(maxDate)
    val today = LocalDate.now()

    var viewMonth by remember {
        mutableStateOf(YearMonth.from(startD ?: today))
    }
    var selecting by remember { mutableStateOf("start") }

    val secondMonth = viewMonth.plusMonths(1)

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // -- Selection mode indicator --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            FilterChip(
                selected = selecting == "start",
                onClick = { selecting = "start" },
                label = { Text("Start: ${startDate ?: "---"}") },
                enabled = enabled,
            )
            FilterChip(
                selected = selecting == "end",
                onClick = { selecting = "end" },
                label = { Text("End: ${endDate ?: "---"}") },
                enabled = enabled,
            )
        }

        // -- Month navigation --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(
                onClick = { viewMonth = viewMonth.minusMonths(1) },
                enabled = enabled,
            ) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowLeft, contentDescription = "Previous month")
            }

            Text(
                text = "${viewMonth.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())} ${viewMonth.year}" +
                    "  /  " +
                    "${secondMonth.month.getDisplayName(TextStyle.SHORT, Locale.getDefault())} ${secondMonth.year}",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )

            IconButton(
                onClick = { viewMonth = viewMonth.plusMonths(1) },
                enabled = enabled,
            ) {
                Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, contentDescription = "Next month")
            }
        }

        // -- Two calendars side by side --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            MiniCalendar(
                yearMonth = viewMonth,
                selectedStart = startD,
                selectedEnd = endD,
                minDate = minD,
                maxDate = maxD,
                enabled = enabled,
                onDayClick = { date ->
                    val iso = date.toString()
                    if (selecting == "start") {
                        onRangeChange?.invoke(DateRange(iso, endDate ?: iso))
                        selecting = "end"
                    } else {
                        val sDate = startDate ?: iso
                        if (iso < sDate) {
                            onRangeChange?.invoke(DateRange(iso, sDate))
                        } else {
                            onRangeChange?.invoke(DateRange(sDate, iso))
                        }
                        selecting = "start"
                    }
                },
                modifier = Modifier.weight(1f),
            )

            MiniCalendar(
                yearMonth = secondMonth,
                selectedStart = startD,
                selectedEnd = endD,
                minDate = minD,
                maxDate = maxD,
                enabled = enabled,
                onDayClick = { date ->
                    val iso = date.toString()
                    if (selecting == "start") {
                        onRangeChange?.invoke(DateRange(iso, endDate ?: iso))
                        selecting = "end"
                    } else {
                        val sDate = startDate ?: iso
                        if (iso < sDate) {
                            onRangeChange?.invoke(DateRange(iso, sDate))
                        } else {
                            onRangeChange?.invoke(DateRange(sDate, iso))
                        }
                        selecting = "start"
                    }
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}
