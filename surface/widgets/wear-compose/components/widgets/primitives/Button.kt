// ============================================================
// Clef Surface Wear Compose Widget -- Button
//
// Action trigger button adapted for round Wear OS screens.
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
fun ClefButton(
    label: String,
    onClick: () -> Unit,
    variant: String = "filled",
    enabled: Boolean = true,
    loading: Boolean = false,
    modifier: Modifier = Modifier
) {
    Chip(
        onClick = onClick,
        enabled = enabled && !loading,
        label = {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
            } else {
                Text(label)
            }
        },
        modifier = modifier.fillMaxWidth(),
        colors = when (variant) {
            "outline" -> ChipDefaults.outlinedChipColors()
            else -> ChipDefaults.primaryChipColors()
        }
    )
}
