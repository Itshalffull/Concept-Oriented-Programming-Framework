// ============================================================
// Clef Surface Compose Widget — PermissionMatrix
//
// Role-based access control grid mapping roles (columns)
// against permissions (rows). Each intersection cell contains
// a Checkbox toggle. Renders as a grid with header row of role
// names, permission row labels, and a Checkbox at each
// permission-role intersection.
// Maps permission-matrix.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Permission matrix composable rendering a grid of checkboxes
 * with roles as columns and permissions as rows. Tapping a
 * checkbox toggles the grant status for that permission-role pair.
 *
 * @param roles Array of role names (displayed as column headers).
 * @param permissions Array of permission names (displayed as row labels).
 * @param matrix Nested map: matrix[permission][role] = granted.
 * @param onChange Callback when a permission toggle is changed.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun PermissionMatrix(
    roles: List<String>,
    permissions: List<String>,
    matrix: Map<String, Map<String, Boolean>>,
    onChange: ((permission: String, role: String, granted: Boolean) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Permission",
                    modifier = Modifier.weight(2f),
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.labelMedium,
                )
                roles.forEach { role ->
                    Text(
                        text = role,
                        modifier = Modifier.weight(1f),
                        fontWeight = FontWeight.Bold,
                        style = MaterialTheme.typography.labelMedium,
                    )
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))

            // Permission Rows
            if (permissions.isEmpty()) {
                Text(
                    text = "No permissions defined.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(vertical = 8.dp),
                )
            } else {
                LazyColumn {
                    itemsIndexed(permissions) { _, permission ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = permission,
                                modifier = Modifier.weight(2f),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            roles.forEach { role ->
                                val granted = matrix[permission]?.get(role) ?: false
                                Box(
                                    modifier = Modifier.weight(1f),
                                    contentAlignment = Alignment.Center,
                                ) {
                                    Checkbox(
                                        checked = granted,
                                        onCheckedChange = { checked ->
                                            onChange?.invoke(permission, role, checked)
                                        },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
