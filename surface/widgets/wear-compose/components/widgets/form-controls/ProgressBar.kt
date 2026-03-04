// ============================================================
// Clef Surface Wear Compose Widget -- ProgressBar
//
// Linear or circular progress indicator.
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
fun ClefProgressBar(
    progress: Float,
    variant: String = "circular",
    label: String? = null,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        label?.let { Text(it, style = MaterialTheme.typography.caption2) }
        if (variant == "linear") {
            LinearProgressIndicator(progress = progress, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp))
        } else {
            CircularProgressIndicator(progress = progress, modifier = Modifier.size(48.dp))
        }
        Text("${(progress * 100).toInt()}%", style = MaterialTheme.typography.caption2)
    }
}
