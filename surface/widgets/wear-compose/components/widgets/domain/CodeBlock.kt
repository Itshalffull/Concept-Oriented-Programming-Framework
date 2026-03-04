// ============================================================
// Clef Surface Wear Compose Widget - CodeBlock
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
fun CodeBlock(code: String = "", language: String = "", modifier: Modifier = Modifier) {
    Card(onClick = {}, modifier = modifier.fillMaxWidth()) {
        Column { if (language.isNotEmpty()) Text(language, fontSize = 8.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f))
            Text(code, fontSize = 9.sp, maxLines = 10, overflow = TextOverflow.Ellipsis) }
    }
}
