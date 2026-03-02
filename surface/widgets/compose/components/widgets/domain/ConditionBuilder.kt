// ============================================================
// Clef Surface Compose Widget — ConditionBuilder
//
// Composable condition row builder for constructing filter and
// rule expressions. Renders a column of condition rows with
// IF/AND/OR logic toggles, field/operator/value display, and
// add/remove actions.
//
// Adapts the condition-builder.widget spec: anatomy (root, rows,
// row, fieldSelector, operatorSelector, valueInput, removeButton,
// logicToggle, addButton), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class Condition(
    val field: String,
    val operator: String,
    val value: String,
    val conjunction: String = "AND",
)

// --------------- Component ---------------

/**
 * Condition row builder for constructing filter/rule expressions.
 *
 * @param conditions List of conditions.
 * @param selectedIndex Index of the currently selected condition.
 * @param onSelectCondition Callback when a condition row is tapped.
 * @param onAdd Callback to add a new condition.
 * @param onRemove Callback to remove a condition by index.
 * @param onChange Callback when a condition changes.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ConditionBuilder(
    conditions: List<Condition>,
    selectedIndex: Int = -1,
    onSelectCondition: (Int) -> Unit = {},
    onAdd: () -> Unit = {},
    onRemove: (Int) -> Unit = {},
    onChange: (Int, Condition) -> Unit = { _, _ -> },
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            itemsIndexed(conditions) { index, cond ->
                val isSelected = index == selectedIndex
                val prefix = if (index == 0) "IF" else cond.conjunction

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectCondition(index) },
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
                            text = prefix,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.tertiary,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = cond.field,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = cond.operator,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.secondary,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = cond.value,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { onRemove(index) }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove condition",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onAdd,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = "+ Add Condition")
        }
    }
}
