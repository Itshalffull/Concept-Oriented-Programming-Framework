// ============================================================
// Clef Surface Compose Widget — PropertyPanel
//
// Click-to-edit property list panel displaying typed property
// rows with Name: Value format. Editable properties support
// inline editing. Renders as a LazyColumn of label-value pairs
// with appropriate controls for boolean (switch), text, and
// number property types.
// Maps property-panel.widget anatomy.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.composites

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Property(
    val name: String,
    val type: PropertyType,
    val value: Any?,
    val editable: Boolean = true,
)

enum class PropertyType { TEXT, NUMBER, BOOLEAN, SELECT }

// --------------- Component ---------------

/**
 * Property panel composable displaying a list of typed property
 * rows with name-value pairs and inline editing controls for
 * editable properties.
 *
 * @param properties Array of property definitions.
 * @param title Panel title.
 * @param onChange Callback when a property value changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun PropertyPanel(
    properties: List<Property>,
    title: String = "Properties",
    onChange: ((name: String, value: Any?) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Property Rows
            if (properties.isEmpty()) {
                Text(
                    text = "No properties.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    itemsIndexed(properties) { _, prop ->
                        PropertyRow(property = prop, onChange = onChange)
                    }
                }
            }
        }
    }
}

@Composable
private fun PropertyRow(
    property: Property,
    onChange: ((String, Any?) -> Unit)?,
) {
    val valueStr = when (property.type) {
        PropertyType.BOOLEAN -> if (property.value == true) "true" else "false"
        else -> property.value?.toString() ?: ""
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = property.name,
            modifier = Modifier.weight(1f),
            fontWeight = FontWeight.Medium,
            style = MaterialTheme.typography.bodyMedium,
        )
        Text(
            text = ": ",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )

        when {
            property.type == PropertyType.BOOLEAN && property.editable -> {
                Switch(
                    checked = property.value == true,
                    onCheckedChange = { checked ->
                        onChange?.invoke(property.name, checked)
                    },
                )
            }
            property.editable -> {
                Text(
                    text = valueStr,
                    modifier = Modifier.clickable { /* enter edit mode */ },
                    color = MaterialTheme.colorScheme.primary,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            else -> {
                Text(
                    text = valueStr,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "(read-only)",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}
