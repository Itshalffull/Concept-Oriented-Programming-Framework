// ============================================================
// Clef Surface Wear Compose Widget -- RadioGroup
//
// Group of mutually exclusive radio options.
// Simplified for round Wear OS screens.
// ============================================================

package com.clef.surface.wear.widgets.formcontrols

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*

@Composable
fun ClefRadioGroup(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    label: String? = null,
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        label?.let { item { Text(it, style = MaterialTheme.typography.caption1) } }
        items(options.size) { i ->
            ToggleChip(
                checked = i == selectedIndex,
                onCheckedChange = { onSelect(i) },
                label = { Text(options[i]) },
                toggleControl = { ToggleChipDefaults.RadioIcon(checked = i == selectedIndex) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
