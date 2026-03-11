// ============================================================
// Clef Surface Wear Compose Widget - DataList
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
fun DataList(
    rows: List<Pair<String, String>> = emptyList(),
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(rows.size) { i ->
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(rows[i].first, fontSize = 10.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
                Text(rows[i].second, fontSize = 10.sp)
            }
        }
    }
}
