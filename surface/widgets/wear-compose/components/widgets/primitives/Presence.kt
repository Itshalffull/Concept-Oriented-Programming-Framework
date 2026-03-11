// ============================================================
// Clef Surface Wear Compose Widget -- Presence
//
// Indicates online/offline/away status.
// Simplified for round Wear OS screens.
// ============================================================

package com.clef.surface.wear.widgets.primitives

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
fun ClefPresence(
    status: String = "online",
    size: Dp = 10.dp,
    modifier: Modifier = Modifier
) {
    val color = when (status) {
        "online" -> Color.Green
        "away" -> Color.Yellow
        "busy" -> Color.Red
        else -> Color.Gray
    }
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(color)
    )
}
