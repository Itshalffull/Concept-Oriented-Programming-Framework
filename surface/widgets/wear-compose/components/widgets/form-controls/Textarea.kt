// ============================================================
// Clef Surface Wear Compose Widget -- Textarea
//
// Multi-line text input.
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
fun ClefTextarea(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String = "",
    modifier: Modifier = Modifier
) {
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth().heightIn(min = 80.dp)
            .background(MaterialTheme.colors.surface, RoundedCornerShape(8.dp)).padding(8.dp),
        textStyle = LocalTextStyle.current.copy(color = MaterialTheme.colors.onSurface),
        decorationBox = { inner ->
            Box { if (value.isEmpty()) Text(placeholder, color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f)); inner() }
        }
    )
}
