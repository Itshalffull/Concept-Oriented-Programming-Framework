// ============================================================
// Clef Surface Wear Compose Widget -- Avatar
//
// Displays a user avatar image or initials on a round surface.
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
fun ClefAvatar(
    imageUrl: String? = null,
    initials: String = "",
    size: Dp = 40.dp,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(MaterialTheme.colors.primary),
        contentAlignment = Alignment.Center
    ) {
        if (imageUrl != null) {
            // Image loading placeholder
            Text(initials.take(2), color = MaterialTheme.colors.onPrimary, fontSize = (size.value / 2.5).sp)
        } else {
            Text(initials.take(2), color = MaterialTheme.colors.onPrimary, fontSize = (size.value / 2.5).sp)
        }
    }
}
