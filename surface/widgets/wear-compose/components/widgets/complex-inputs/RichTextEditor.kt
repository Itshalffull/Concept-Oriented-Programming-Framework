// ============================================================
// Clef Surface Wear Compose Widget - RichTextEditor
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.complexinputs

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
fun RichTextEditor(
    value: String = "",
    onClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Chip(
        onClick = onClick,
        label = { Text(value.ifEmpty { "Edit text..." }, fontSize = 11.sp, maxLines = 4) },
        modifier = modifier.fillMaxWidth()
    )
}
