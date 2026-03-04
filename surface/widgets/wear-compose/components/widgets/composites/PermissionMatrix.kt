// ============================================================
// Clef Surface Wear Compose Widget - PermissionMatrix
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
fun PermissionMatrix(roles: List<String> = emptyList(), permissions: List<String> = emptyList(), granted: List<List<Boolean>> = emptyList(), modifier: Modifier = Modifier) {
    ScalingLazyColumn(modifier = modifier) {
        roles.forEachIndexed { r, role ->
            item { Text(role, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
            permissions.forEachIndexed { p, perm -> item { Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(perm, fontSize = 9.sp); Text(if (r < granted.size && p < granted[r].size && granted[r][p]) "✓" else "✗", fontSize = 9.sp) } } }
        }
    }
}
