package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun HitlInterrupt() {
    var state by remember { mutableStateOf("pending") }
    Column { Text(text = "HitlInterrupt") }
}
