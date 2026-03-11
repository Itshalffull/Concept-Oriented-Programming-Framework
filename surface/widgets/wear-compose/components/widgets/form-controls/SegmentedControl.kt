// ============================================================
// Clef Surface Wear Compose Widget -- SegmentedControl
//
// Segmented button group.
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
fun ClefSegmentedControl(
    options: List<String>,
    selectedIndex: Int,
    onSelect: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        options.forEachIndexed { i, opt ->
            CompactChip(
                onClick = { onSelect(i) },
                label = { Text(opt, fontSize = 10.sp) },
                colors = if (i == selectedIndex) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors()
            )
        }
    }
}
