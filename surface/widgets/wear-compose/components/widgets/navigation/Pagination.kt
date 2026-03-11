// ============================================================
// Clef Surface Wear Compose Widget - Pagination
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.navigation

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
fun Pagination(
    currentPage: Int = 1,
    totalPages: Int = 1,
    onPageChange: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        CompactChip(onClick = { if (currentPage > 1) onPageChange(currentPage - 1) }, label = { Text("<") })
        Text("$currentPage/$totalPages", fontSize = 12.sp)
        CompactChip(onClick = { if (currentPage < totalPages) onPageChange(currentPage + 1) }, label = { Text(">") })
    }
}
