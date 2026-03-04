// ============================================================
// Clef Surface Wear Compose Widget - PolicyEditor
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
fun PolicyEditor(policies: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Policies", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(policies.size) { i -> Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(policies[i].first, fontSize = 10.sp); Text(policies[i].second, fontSize = 10.sp, color = if (policies[i].second == "allow") androidx.compose.ui.graphics.Color.Green else androidx.compose.ui.graphics.Color.Red) } }
    }
}
