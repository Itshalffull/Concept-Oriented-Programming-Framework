// ============================================================
// Clef Surface Wear Compose Widget - TokenInput
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
fun TokenInput(tokens: List<String> = emptyList(), onRemove: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    Column(modifier = modifier) {
        androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            items(tokens.size) { i -> CompactChip(onClick = { onRemove(i) }, label = { Text(tokens[i], fontSize = 9.sp) }) }
        }
    }
}
