// ============================================================
// Clef Surface Wear Compose Widget -- NumberInput
//
// Numeric input with increment/decrement.
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
fun ClefNumberInput(
    value: Int,
    onValueChange: (Int) -> Unit,
    min: Int = Int.MIN_VALUE,
    max: Int = Int.MAX_VALUE,
    label: String? = null,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        label?.let { Text(it, style = MaterialTheme.typography.caption2) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            CompactChip(onClick = { if (value > min) onValueChange(value - 1) }, label = { Text("-") })
            Text(value.toString(), style = MaterialTheme.typography.title2)
            CompactChip(onClick = { if (value < max) onValueChange(value + 1) }, label = { Text("+") })
        }
    }
}
