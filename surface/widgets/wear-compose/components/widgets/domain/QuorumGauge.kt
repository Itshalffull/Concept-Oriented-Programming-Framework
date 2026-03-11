package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun QuorumGauge() {
    var state by remember { mutableStateOf("belowThreshold") }
    Column { Text(text = "QuorumGauge") }
}
