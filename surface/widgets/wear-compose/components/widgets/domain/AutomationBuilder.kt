// ============================================================
// Clef Surface Wear Compose Widget - AutomationBuilder
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.domain

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
fun AutomationBuilder(steps: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Automation", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(steps.size) { i -> Card(onClick = {}, modifier = Modifier.fillMaxWidth()) { Row { Text("${i+1}.", fontSize = 10.sp); Spacer(Modifier.width(4.dp)); Text(steps[i].first, fontSize = 10.sp); Spacer(Modifier.width(4.dp)); Text(steps[i].second, fontSize = 9.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.6f)) } } }
    }
}
