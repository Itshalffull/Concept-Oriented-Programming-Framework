// ============================================================
// Clef Surface Wear Compose Widget - Splitter
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
fun Splitter(
    top: @Composable () -> Unit = {},
    bottom: @Composable () -> Unit = {},
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        item { top() }
        item { Separator() }
        item { bottom() }
    }
}
