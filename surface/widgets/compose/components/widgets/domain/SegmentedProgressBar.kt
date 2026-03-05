package com.clef.surface.widgets.concepts

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics

@Composable
fun SegmentedProgressBar(
    modifier: Modifier = Modifier,
) {
    var state by remember { mutableStateOf("idle") }

    Column(
        modifier = modifier.semantics {
            contentDescription = "Horizontal progress bar divided into col"
        }
    ) {
        Box { /* bar: Horizontal bar divided into segments */ }
        Box { /* segment: Single colored segment */ }
        Text(text = "Tooltip label with count and percentage")
        Box { /* legend: Optional color legend below the bar */ }
    }
}
