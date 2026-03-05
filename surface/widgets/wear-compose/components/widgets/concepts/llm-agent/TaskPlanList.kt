package com.clef.surface.widgets.concepts

import androidx.compose.runtime.*
import androidx.wear.compose.material.*
import androidx.compose.foundation.layout.*

@Composable
fun TaskPlanList() {
    var state by remember { mutableStateOf("idle") }
    Column { Text(text = "TaskPlanList") }
}
