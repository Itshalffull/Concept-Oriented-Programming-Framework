// ============================================================
// Clef Surface Wear Compose Widget - SlashMenu
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
fun SlashMenu(commands: List<Pair<String, String>> = emptyList(), onSelect: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        items(commands.size) { i -> Chip(onClick = { onSelect(i) }, label = { Text(commands[i].first, fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth()) }
    }
}
