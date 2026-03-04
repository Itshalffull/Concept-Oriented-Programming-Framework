// ============================================================
// Clef Surface Wear Compose Widget -- Select
//
// Single selection dropdown.
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
fun ClefSelect(
    options: List<String>,
    selectedIndex: Int = -1,
    onSelect: (Int) -> Unit,
    placeholder: String = "Select...",
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(options.size) { i ->
            Chip(
                onClick = { onSelect(i) },
                label = { Text(options[i]) },
                colors = if (i == selectedIndex) ChipDefaults.primaryChipColors() else ChipDefaults.secondaryChipColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
