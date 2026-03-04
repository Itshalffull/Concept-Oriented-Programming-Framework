// ============================================================
// Clef Surface Wear Compose Widget - Accordion
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
fun Accordion(
    sections: List<Pair<String, @Composable () -> Unit>> = emptyList(),
    modifier: Modifier = Modifier
) {
    val expanded = remember { mutableStateMapOf<Int, Boolean>() }
    ScalingLazyColumn(modifier = modifier) {
        sections.forEachIndexed { i, (title, content) ->
            item {
                Chip(
                    onClick = { expanded[i] = !(expanded[i] ?: false) },
                    label = { Text(title, fontSize = 12.sp, fontWeight = FontWeight.Medium) },
                    modifier = Modifier.fillMaxWidth()
                )
            }
            if (expanded[i] == true) {
                item { content() }
            }
        }
    }
}
