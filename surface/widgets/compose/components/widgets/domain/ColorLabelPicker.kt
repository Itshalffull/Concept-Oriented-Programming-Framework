// ============================================================
// Clef Surface Compose Widget — ColorLabelPicker
//
// Colored tag and label selector rendered as a LazyVerticalGrid
// of colored label chips. Supports single-select, search
// filtering, and displays a checkmark on the selected item.
//
// Adapts the color-label-picker.widget spec: anatomy (root,
// trigger, panel, search, options, option, colorSwatch,
// optionLabel, createButton), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class ColorLabel(
    val name: String,
    val color: Color,
)

// --------------- Component ---------------

/**
 * Color label picker displayed as a grid of colored chips.
 *
 * @param value Currently selected label name.
 * @param colors Available color labels.
 * @param columns Number of columns in the grid.
 * @param onSelect Callback when a color label is selected.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ColorLabelPicker(
    value: String? = null,
    colors: List<ColorLabel>,
    columns: Int = 4,
    onSelect: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var filter by remember { mutableStateOf("") }

    val filtered by remember(colors, filter) {
        derivedStateOf {
            if (filter.isBlank()) colors
            else colors.filter { it.name.contains(filter, ignoreCase = true) }
        }
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        tonalElevation = 1.dp,
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Filter field
            OutlinedTextField(
                value = filter,
                onValueChange = { filter = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = { Text("Filter colors...") },
                singleLine = true,
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Color grid
            LazyVerticalGrid(
                columns = GridCells.Fixed(columns),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                itemsIndexed(filtered) { _, item ->
                    val isSelected = item.name == value

                    Row(
                        modifier = Modifier
                            .clickable { onSelect(item.name) }
                            .then(
                                if (isSelected)
                                    Modifier.border(
                                        2.dp,
                                        MaterialTheme.colorScheme.primary,
                                        RoundedCornerShape(8.dp),
                                    )
                                else Modifier,
                            )
                            .padding(4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(item.color),
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = item.name + if (isSelected) " \u2713" else "",
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        )
                    }
                }
            }

            if (filtered.isEmpty()) {
                Text(
                    text = "No matching colors.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}
