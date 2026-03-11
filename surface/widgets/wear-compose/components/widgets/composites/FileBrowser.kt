// ============================================================
// Clef Surface Wear Compose Widget - FileBrowser
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
fun FileBrowser(path: String = "/", items: List<Pair<String, Boolean>> = emptyList(), onSelect: (Int) -> Unit = {}, modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text(path, fontSize = 9.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)) }
        items(items.size) { i ->
            val (name, isFolder) = items[i]
            Chip(onClick = { onSelect(i) }, label = { Text((if (isFolder) "📁 " else "📄 ") + name, fontSize = 11.sp) }, modifier = Modifier.fillMaxWidth())
        }
    }
}
