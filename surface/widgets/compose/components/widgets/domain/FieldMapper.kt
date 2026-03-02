// ============================================================
// Clef Surface Compose Widget — FieldMapper
//
// Field mapping interface rendered as two columns (source and
// target) with connection lines drawn between mapped pairs.
// Supports adding new mappings and removing existing ones.
//
// Adapts the field-mapper.widget spec: anatomy (root, mappingRow,
// targetField, targetLabel, mappingInput, insertFieldButton,
// fieldPicker), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class FieldMapping(
    val source: String,
    val target: String,
)

// --------------- Component ---------------

/**
 * Two-column field mapping interface with connection indicators.
 *
 * @param sourceFields Available source fields.
 * @param targetFields Available target fields.
 * @param mappings Current field mappings.
 * @param selectedIndex Index of the currently selected mapping.
 * @param onSelectMapping Callback when a mapping row is tapped.
 * @param onMap Callback to create a new mapping.
 * @param onUnmap Callback to remove a mapping.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun FieldMapper(
    sourceFields: List<String>,
    targetFields: List<String>,
    mappings: List<FieldMapping>,
    selectedIndex: Int = -1,
    onSelectMapping: (Int) -> Unit = {},
    onMap: (String, String) -> Unit = { _, _ -> },
    onUnmap: (String, String) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        // Header
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "Source",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                textDecoration = TextDecoration.Underline,
                modifier = Modifier.weight(1f),
            )
            Spacer(modifier = Modifier.width(32.dp))
            Text(
                text = "Target",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                textDecoration = TextDecoration.Underline,
                modifier = Modifier.weight(1f),
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Mapped pairs
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            itemsIndexed(mappings) { index, mapping ->
                val isSelected = index == selectedIndex

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectMapping(index) },
                    colors = CardDefaults.cardColors(
                        containerColor = if (isSelected)
                            MaterialTheme.colorScheme.primaryContainer
                        else
                            MaterialTheme.colorScheme.surface,
                    ),
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = mapping.source,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            text = " \u2192 ",
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = mapping.target,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { onUnmap(mapping.source, mapping.target) }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove mapping",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }

        // Unmapped fields
        val mappedSources = mappings.map { it.source }.toSet()
        val unmapped = sourceFields.filter { it !in mappedSources }
        if (unmapped.isNotEmpty()) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Unmapped: ${unmapped.joinToString(", ")}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // Add mapping button
        Spacer(modifier = Modifier.height(8.dp))
        OutlinedButton(
            onClick = {
                val mappedTargets = mappings.map { it.target }.toSet()
                val unmappedSource = sourceFields.firstOrNull { it !in mappedSources }
                val unmappedTarget = targetFields.firstOrNull { it !in mappedTargets }
                if (unmappedSource != null && unmappedTarget != null) {
                    onMap(unmappedSource, unmappedTarget)
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = "+ Map")
        }
    }
}
