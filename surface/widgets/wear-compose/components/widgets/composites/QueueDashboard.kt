// ============================================================
// Clef Surface Wear Compose Widget - QueueDashboard
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.composites

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
fun QueueDashboard(pending: Int = 0, active: Int = 0, failed: Int = 0, jobs: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("$pending", fontSize = 14.sp, fontWeight = FontWeight.Bold); Text("Pend", fontSize = 8.sp) }
            Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("$active", fontSize = 14.sp, fontWeight = FontWeight.Bold); Text("Active", fontSize = 8.sp) }
            Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("$failed", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = androidx.compose.ui.graphics.Color.Red); Text("Fail", fontSize = 8.sp) }
        } }
        items(jobs.size) { i -> Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(jobs[i].first, fontSize = 9.sp); Text(jobs[i].second, fontSize = 9.sp) } }
    }
}
