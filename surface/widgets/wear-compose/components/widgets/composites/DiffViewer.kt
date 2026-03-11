// ============================================================
// Clef Surface Wear Compose Widget - DiffViewer
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
fun DiffViewer(lines: List<Pair<String, String>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        items(lines.size) { i ->
            val (type, content) = lines[i]
            val prefix = when (type) { "added" -> "+"; "removed" -> "-"; else -> " " }
            val color = when (type) { "added" -> androidx.compose.ui.graphics.Color.Green; "removed" -> androidx.compose.ui.graphics.Color.Red; else -> MaterialTheme.colors.onSurface }
            Text("$prefix $content", fontSize = 9.sp, color = color, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}
