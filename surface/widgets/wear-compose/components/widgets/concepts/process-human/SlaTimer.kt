package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun SlaTimer() {
    var state by remember { mutableStateOf("onTrack") }
    Column { Text(text = "SlaTimer") }
}
