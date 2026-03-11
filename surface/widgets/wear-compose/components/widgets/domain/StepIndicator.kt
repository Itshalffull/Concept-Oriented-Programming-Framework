// ============================================================
// Clef Surface Wear Compose Widget - StepIndicator
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
fun StepIndicator(steps: List<String> = emptyList(), currentStep: Int = 0, modifier: Modifier = Modifier) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
        steps.forEachIndexed { i, step ->
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(if (i < currentStep) "✓" else "${i+1}", fontSize = 10.sp, fontWeight = if (i == currentStep) FontWeight.Bold else FontWeight.Normal)
                Text(step, fontSize = 7.sp, maxLines = 1)
            }
            if (i < steps.size - 1) Text("—", fontSize = 8.sp)
        }
    }
}
