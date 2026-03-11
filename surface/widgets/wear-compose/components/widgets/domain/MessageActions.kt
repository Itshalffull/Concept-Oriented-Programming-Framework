package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun MessageActions() {
    var state by remember { mutableStateOf("hidden") }
    Column { Text(text = "MessageActions") }
}
