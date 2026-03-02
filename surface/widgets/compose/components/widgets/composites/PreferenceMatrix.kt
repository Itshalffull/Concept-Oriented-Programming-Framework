// ============================================================
// Clef Surface Compose Widget — PreferenceMatrix
//
// Grouped preference grid with category headers and toggle
// controls for each preference item. Categories contain named
// preferences with their current values. Renders as a Column
// with category dividers and rows of toggle switches or
// dropdown-style selectors for each preference.
// Maps preference-matrix.widget anatomy.
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Preference(
    val key: String,
    val label: String,
    val type: PreferenceType,
    val options: List<String>? = null,
)

enum class PreferenceType { TOGGLE, SELECT }

data class PreferenceCategory(
    val name: String,
    val preferences: List<Preference>,
)

// --------------- Component ---------------

/**
 * Preference matrix composable rendering grouped preference
 * items with toggle switches and dropdown selectors organized
 * under category headers.
 *
 * @param categories Array of preference categories with their items.
 * @param values Current preference values keyed by preference key.
 * @param onChange Callback when a preference value changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun PreferenceMatrix(
    categories: List<PreferenceCategory>,
    values: Map<String, Any?>,
    onChange: ((key: String, value: Any?) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    data class FlatPref(
        val category: String,
        val pref: Preference,
        val isFirstInCategory: Boolean,
    )

    val flatPrefs = remember(categories) {
        categories.flatMap { cat ->
            cat.preferences.mapIndexed { index, pref ->
                FlatPref(
                    category = cat.name,
                    pref = pref,
                    isFirstInCategory = index == 0,
                )
            }
        }
    }

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Preferences",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (flatPrefs.isEmpty()) {
                Text(
                    text = "No preferences.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                LazyColumn {
                    itemsIndexed(flatPrefs) { index, item ->
                        // Category Header
                        if (item.isFirstInCategory) {
                            if (index > 0) {
                                Spacer(modifier = Modifier.height(12.dp))
                            }
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                HorizontalDivider(modifier = Modifier.width(16.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = item.category,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    style = MaterialTheme.typography.labelMedium,
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                HorizontalDivider(modifier = Modifier.weight(1f))
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                        }

                        // Preference Row
                        val currentValue = values[item.pref.key]

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = item.pref.label,
                                modifier = Modifier.weight(1f),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            when (item.pref.type) {
                                PreferenceType.TOGGLE -> {
                                    Switch(
                                        checked = currentValue as? Boolean ?: false,
                                        onCheckedChange = { checked ->
                                            onChange?.invoke(item.pref.key, checked)
                                        },
                                    )
                                }
                                PreferenceType.SELECT -> {
                                    val options = item.pref.options ?: emptyList()
                                    val displayValue = (currentValue as? String)
                                        ?: options.firstOrNull()
                                        ?: "?"
                                    AssistChip(
                                        onClick = {
                                            // Cycle through options
                                            if (options.isNotEmpty()) {
                                                val currentIdx = options.indexOf(displayValue)
                                                val nextIdx = (currentIdx + 1) % options.size
                                                onChange?.invoke(item.pref.key, options[nextIdx])
                                            }
                                        },
                                        label = { Text("$displayValue \u25BC") },
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
