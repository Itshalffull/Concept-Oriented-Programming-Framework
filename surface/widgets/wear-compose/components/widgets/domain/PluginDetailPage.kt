// ============================================================
// Clef Surface Wear Compose Widget - PluginDetailPage
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
fun PluginDetailPage(name: String = "", version: String = "", description: String = "", author: String = "", modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text(name, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
        if (version.isNotEmpty()) { item { Text("v$version", fontSize = 10.sp) } }
        if (author.isNotEmpty()) { item { Text("By $author", fontSize = 10.sp) } }
        item { Text(description, fontSize = 10.sp) }
    }
}
