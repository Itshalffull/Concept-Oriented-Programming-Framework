package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun TraceStepControls() {
    var state by remember { mutableStateOf("paused") }
    Column { Text(text = "TraceStepControls") }
}
