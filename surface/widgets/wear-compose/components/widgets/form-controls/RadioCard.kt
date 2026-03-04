// ============================================================
// Clef Surface Wear Compose Widget -- RadioCard
//
// Selectable card with radio behavior.
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
fun ClefRadioCard(
    selected: Boolean,
    onClick: () -> Unit,
    title: String,
    description: String? = null,
    modifier: Modifier = Modifier
) {
    TitleCard(
        onClick = onClick,
        title = { Text(title) },
        modifier = modifier.fillMaxWidth(),
        backgroundPainter = CardDefaults.cardBackgroundPainter(
            startBackgroundColor = if (selected) MaterialTheme.colors.primary.copy(alpha = 0.2f) else MaterialTheme.colors.surface
        )
    ) {
        description?.let { Text(it, style = MaterialTheme.typography.caption2) }
    }
}
