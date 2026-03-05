package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun ArtifactPanel() {
    var state by remember { mutableStateOf("open") }
    Column { Text(text = "ArtifactPanel") }
}
