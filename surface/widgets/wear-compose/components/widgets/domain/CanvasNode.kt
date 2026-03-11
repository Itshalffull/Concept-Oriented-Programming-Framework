// ============================================================
// Clef Surface Wear Compose Widget - CanvasNode
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
fun CanvasNode(title: String = "Node", type: String = "default", modifier: Modifier = Modifier) {
    Card(onClick = {}, modifier = modifier) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(title, fontSize = 10.sp, fontWeight = FontWeight.Bold); Text(type, fontSize = 8.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)) } }
}
