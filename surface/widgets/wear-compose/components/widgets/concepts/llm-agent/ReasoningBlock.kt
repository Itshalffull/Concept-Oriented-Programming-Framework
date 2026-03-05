package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun ReasoningBlock() {
    var state by remember { mutableStateOf("collapsed") }
    Column { Text(text = "ReasoningBlock") }
}
