package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun ToolInvocation() {
    var state by remember { mutableStateOf("collapsed") }
    Column { Text(text = "ToolInvocation") }
}
