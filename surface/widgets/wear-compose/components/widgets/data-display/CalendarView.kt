// ============================================================
// Clef Surface Wear Compose Widget - CalendarView
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.datadisplay

import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.wear.compose.material.*
import androidx.wear.compose.foundation.lazy.*

@Composable
fun CalendarView(
    selectedDate: String = "",
    modifier: Modifier = Modifier
) {
    Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
        Text(selectedDate.ifEmpty { "No date selected" }, fontSize = 12.sp)
    }
}
