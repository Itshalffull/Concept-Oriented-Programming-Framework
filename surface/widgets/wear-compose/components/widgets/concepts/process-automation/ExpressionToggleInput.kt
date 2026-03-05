package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun ExpressionToggleInput() {
    var state by remember { mutableStateOf("fixed") }
    Column { Text(text = "ExpressionToggleInput") }
}
