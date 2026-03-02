// ============================================================
// Clef Surface Compose Widget — SchemaEditor
//
// Field type and validation builder for defining schemas.
// Displays a Column with a list of field rows, each with name,
// type indicator, and optional required badge. Supports adding
// and removing fields with a tree-like structure and property
// editors for each field definition.
// Maps schema-editor.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class SchemaField(
    val name: String,
    val type: String,
    val required: Boolean = false,
)

// --------------- Component ---------------

/**
 * Schema editor composable rendering a list of schema field
 * definitions with name, type badge, required indicator, and
 * add/remove controls for building data schemas.
 *
 * @param schema Array of field definitions.
 * @param onAddField Callback to add a new field.
 * @param onRemoveField Callback to remove a field by index.
 * @param onUpdateField Callback when a field is updated.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun SchemaEditor(
    schema: List<SchemaField>,
    onAddField: (() -> Unit)? = null,
    onRemoveField: ((Int) -> Unit)? = null,
    onUpdateField: ((Int, SchemaField) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Schema Editor",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(${schema.size} fields)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.titleMedium,
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Field Rows
            if (schema.isEmpty()) {
                Text(
                    text = "No fields defined.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    itemsIndexed(schema) { index, field ->
                        SchemaFieldRow(
                            field = field,
                            onRemove = { onRemoveField?.invoke(index) },
                            onToggleRequired = {
                                onUpdateField?.invoke(index, field.copy(required = !field.required))
                            },
                        )
                    }
                }
            }

            // Add Field Button
            Spacer(modifier = Modifier.height(12.dp))
            OutlinedButton(onClick = { onAddField?.invoke() }) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Add Field")
            }
        }
    }
}

@Composable
private fun SchemaFieldRow(
    field: SchemaField,
    onRemove: () -> Unit,
    onToggleRequired: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Field name
        Text(
            text = field.name,
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = ": ",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        // Type badge
        Surface(
            shape = MaterialTheme.shapes.small,
            color = Color(0xFFFF9800).copy(alpha = 0.15f),
        ) {
            Text(
                text = field.type,
                color = Color(0xFFFF9800),
                style = MaterialTheme.typography.labelMedium,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
        // Required badge
        if (field.required) {
            Spacer(modifier = Modifier.width(4.dp))
            Surface(
                shape = MaterialTheme.shapes.small,
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.15f),
                modifier = Modifier.clickable { onToggleRequired() },
            ) {
                Text(
                    text = "required",
                    color = MaterialTheme.colorScheme.error,
                    fontWeight = FontWeight.Bold,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                )
            }
        } else {
            Spacer(modifier = Modifier.width(4.dp))
            TextButton(
                onClick = onToggleRequired,
                contentPadding = PaddingValues(horizontal = 4.dp, vertical = 0.dp),
            ) {
                Text("optional", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(modifier = Modifier.width(4.dp))
        // Remove button
        IconButton(
            onClick = onRemove,
            modifier = Modifier.size(24.dp),
        ) {
            Icon(
                Icons.Default.Close,
                contentDescription = "Remove field",
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.error,
            )
        }
    }
}
