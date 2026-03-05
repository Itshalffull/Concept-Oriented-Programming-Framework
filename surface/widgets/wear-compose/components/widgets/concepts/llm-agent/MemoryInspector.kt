package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun MemoryInspector() {
    var state by remember { mutableStateOf("viewing") }
    Column { Text(text = "MemoryInspector") }
}
