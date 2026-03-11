// ============================================================
// Clef Surface Wear Compose Widget - SchemaEditor
//
// Wear OS Compose implementation. Adapted for round screen
// using ScalingLazyColumn, Chip, ToggleChip, TimeText.
// ============================================================

package clef.surface.wearcompose.components.widgets.composites

import androidx.compose.runtime.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.wear.compose.material.*
import androidx.wear.compose.foundation.lazy.*

@Composable
fun SchemaEditor(fields: List<Triple<String, String, Boolean>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        item { Text("Schema", fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        items(fields.size) { i -> val (name, type, required) = fields[i]
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(name, fontSize = 10.sp); Text(type + if (required) " *" else "", fontSize = 10.sp)
            }
        }
    }
}
