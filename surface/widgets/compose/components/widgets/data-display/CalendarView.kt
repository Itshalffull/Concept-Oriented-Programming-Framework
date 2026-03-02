// ============================================================
// Clef Surface Compose Widget — CalendarView
//
// Monthly calendar grid for displaying and navigating dates
// with optional event overlays. Compose adaptation: uses
// LazyVerticalGrid for the day cells, Material 3 theming for
// today/selected highlights, and IconButtons for prev/next
// month navigation.
// See widget spec: repertoire/widgets/data-display/calendar-view.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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

data class CalendarEvent(
    val date: LocalDate,
    val label: String,
    val id: String? = null,
)

// --------------- Component ---------------

/**
 * Monthly calendar grid with event overlays and date selection.
 *
 * @param selectedDate Currently selected date.
 * @param yearMonth The month and year to display. Defaults to current month.
 * @param events Events to overlay on the calendar.
 * @param onSelect Callback when a date is selected.
 * @param onNavigate Callback when navigating to a different month.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun CalendarView(
    selectedDate: LocalDate? = null,
    yearMonth: YearMonth = YearMonth.now(),
    events: List<CalendarEvent> = emptyList(),
    onSelect: (LocalDate) -> Unit = {},
    onNavigate: (YearMonth) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val today = LocalDate.now()
    var displayMonth by remember(yearMonth) { mutableIntStateOf(yearMonth.monthValue) }
    var displayYear by remember(yearMonth) { mutableIntStateOf(yearMonth.year) }

    val currentYearMonth = YearMonth.of(displayYear, displayMonth)
    val daysInMonth = currentYearMonth.lengthOfMonth()
    val firstDayOfWeek = currentYearMonth.atDay(1).dayOfWeek.value % 7 // Sunday = 0

    val dayHeaders = listOf("Su", "Mo", "Tu", "We", "Th", "Fr", "Sa")

    fun navigateMonth(delta: Int) {
        val next = currentYearMonth.plusMonths(delta.toLong())
        displayMonth = next.monthValue
        displayYear = next.year
        onNavigate(next)
    }

    fun eventsForDay(day: Int): List<CalendarEvent> {
        val date = LocalDate.of(displayYear, displayMonth, day)
        return events.filter { it.date == date }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        // Header: month navigation
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = { navigateMonth(-1) }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                    contentDescription = "Previous month",
                )
            }
            Text(
                text = "${currentYearMonth.month.getDisplayName(TextStyle.FULL, Locale.getDefault())} $displayYear",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            IconButton(onClick = { navigateMonth(1) }) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                    contentDescription = "Next month",
                )
            }
        }

        // Day-of-week headers
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            dayHeaders.forEach { header ->
                Text(
                    text = header,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        // Calendar grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(7),
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            // Leading empty cells
            items(firstDayOfWeek) {
                Box(modifier = Modifier.aspectRatio(1f))
            }

            // Day cells
            items(daysInMonth) { index ->
                val day = index + 1
                val date = LocalDate.of(displayYear, displayMonth, day)
                val isToday = date == today
                val isSelected = date == selectedDate
                val hasEvents = eventsForDay(day).isNotEmpty()

                val backgroundColor = when {
                    isSelected -> MaterialTheme.colorScheme.primary
                    isToday -> MaterialTheme.colorScheme.primaryContainer
                    else -> MaterialTheme.colorScheme.surface
                }
                val textColor = when {
                    isSelected -> MaterialTheme.colorScheme.onPrimary
                    isToday -> MaterialTheme.colorScheme.onPrimaryContainer
                    else -> MaterialTheme.colorScheme.onSurface
                }

                Box(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .padding(2.dp)
                        .clip(CircleShape)
                        .background(backgroundColor)
                        .clickable { onSelect(date) },
                    contentAlignment = Alignment.Center,
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = day.toString(),
                            style = MaterialTheme.typography.bodySmall,
                            color = textColor,
                            fontWeight = if (isToday || isSelected) FontWeight.Bold else FontWeight.Normal,
                        )
                        if (hasEvents) {
                            Box(
                                modifier = Modifier
                                    .size(4.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.tertiary),
                            )
                        }
                    }
                }
            }
        }
    }
}
