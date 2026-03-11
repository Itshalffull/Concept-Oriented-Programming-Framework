// ============================================================
// Clef Surface Wear Compose Widget - Fieldset
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
fun Fieldset(
    legend: String = "",
    enabled: Boolean = true,
    content: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier.padding(4.dp)) {
        if (legend.isNotEmpty()) {
            Text(legend, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
        }
        Box(modifier = if (!enabled) Modifier then Modifier else Modifier) { content() }
    }
}
