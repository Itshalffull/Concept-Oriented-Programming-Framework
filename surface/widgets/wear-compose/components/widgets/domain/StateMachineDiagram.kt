// ============================================================
// Clef Surface Wear Compose Widget - StateMachineDiagram
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
fun StateMachineDiagram(states: List<Pair<String, Boolean>> = emptyList(), transitions: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        items(states.size) { i -> val (name, isCurrent) = states[i]
            Chip(onClick = {}, label = { Text(name, fontSize = 10.sp) }, colors = if (isCurrent) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(), modifier = Modifier.fillMaxWidth()) }
        items(transitions.size) { i -> Text("${transitions[i].first} → ${transitions[i].second}", fontSize = 9.sp) }
    }
}
