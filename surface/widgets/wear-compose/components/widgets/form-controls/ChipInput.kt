// ============================================================
// Clef Surface Wear Compose Widget -- ChipInput
//
// Input that creates chips/tags from text.
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
fun ClefChipInput(
    tokens: List<String>,
    onTokensChange: (List<String>) -> Unit,
    placeholder: String = "Add...",
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(tokens.size) { i ->
            CompactChip(
                onClick = { onTokensChange(tokens.toMutableList().also { it.removeAt(i) }) },
                label = { Text(tokens[i]) }
            )
        }
        item { Text(placeholder, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)) }
    }
}
