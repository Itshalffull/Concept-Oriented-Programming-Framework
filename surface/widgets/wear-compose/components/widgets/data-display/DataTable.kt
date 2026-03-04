// ============================================================
// Clef Surface Wear Compose Widget - DataTable
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
fun DataTable(
    columns: List<String> = emptyList(),
    rows: List<List<String>> = emptyList(),
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(rows.size) { r ->
            Card(onClick = {}, modifier = Modifier.fillMaxWidth()) {
                Column {
                    columns.forEachIndexed { c, col ->
                        if (c < rows[r].size) {
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text(col, fontSize = 9.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f))
                                Text(rows[r][c], fontSize = 9.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}
