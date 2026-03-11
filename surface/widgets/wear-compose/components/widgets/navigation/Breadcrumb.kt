// ============================================================
// Clef Surface Wear Compose Widget - Breadcrumb
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.navigation

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
fun Breadcrumb(
    crumbs: List<String> = emptyList(),
    onCrumbClick: (Int) -> Unit = {},
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        crumbs.forEachIndexed { i, crumb ->
            if (i > 0) Text("/", fontSize = 10.sp, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f))
            CompactChip(
                onClick = { onCrumbClick(i) },
                label = { Text(crumb, fontSize = 10.sp) }
            )
        }
    }
}
