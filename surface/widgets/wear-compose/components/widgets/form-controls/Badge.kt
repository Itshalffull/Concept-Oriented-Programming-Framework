// ============================================================
// Clef Surface Wear Compose Widget -- Badge
//
// Small status indicator, typically a count.
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
fun ClefBadge(
    count: Int = 0,
    variant: String = "default",
    modifier: Modifier = Modifier
) {
    val bg = when (variant) { "error" -> Color.Red; "success" -> Color.Green; else -> MaterialTheme.colors.primary }
    Box(modifier = modifier.background(bg, CircleShape).padding(horizontal = 6.dp, vertical = 2.dp), contentAlignment = Alignment.Center) {
        Text(if (count > 99) "99+" else count.toString(), color = Color.White, fontSize = 10.sp)
    }
}
