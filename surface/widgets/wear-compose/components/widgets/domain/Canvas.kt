// ============================================================
// Clef Surface Wear Compose Widget - Canvas
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
fun Canvas(modifier: Modifier = Modifier) {
    Card(onClick = {}, modifier = modifier.fillMaxWidth().height(80.dp)) { Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) { Text("Canvas", fontSize = 10.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)) } }
}
