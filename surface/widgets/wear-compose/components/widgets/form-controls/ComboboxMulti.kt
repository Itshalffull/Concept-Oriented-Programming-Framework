// ============================================================
// Clef Surface Wear Compose Widget -- ComboboxMulti
//
// Multi-select dropdown.
// Simplified for round Wear OS screens.
// ============================================================

package com.clef.surface.wear.widgets.formcontrols

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.*

@Composable
fun ClefComboboxMulti(
    options: List<String>,
    selected: Set<Int>,
    onSelectionChange: (Set<Int>) -> Unit,
    modifier: Modifier = Modifier
) {
    ScalingLazyColumn(modifier = modifier) {
        items(options.size) { i ->
            ToggleChip(
                checked = i in selected,
                onCheckedChange = { checked ->
                    onSelectionChange(if (checked) selected + i else selected - i)
                },
                label = { Text(options[i]) },
                toggleControl = { ToggleChipDefaults.CheckboxIcon(checked = i in selected) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
