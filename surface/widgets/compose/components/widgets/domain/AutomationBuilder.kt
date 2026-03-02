// ============================================================
// Clef Surface Compose Widget — AutomationBuilder
//
// Linear step-sequence builder for constructing automation rules.
// Renders a vertical flow of steps connected by arrow connectors,
// with step configuration and an add-step action at the end.
//
// Adapts the automation-builder.widget spec: anatomy (root,
// stepList, step, stepIcon, stepType, stepConfig, addStepButton,
// connector), states (idle, stepSelected, configuring, addingStep,
// reordering, testingStep, testing), and connect attributes to
// Jetpack Compose rendering.
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class AutomationStep(
    val id: String,
    val type: String,
    val config: Map<String, Any>? = null,
)

// --------------- Component ---------------

/**
 * Linear step-sequence builder for constructing automation rules.
 *
 * @param steps Ordered list of automation steps.
 * @param selectedIndex Index of the currently selected step, or -1 for none.
 * @param onSelectStep Callback when a step is tapped.
 * @param onAddStep Callback to add a new step at the end.
 * @param onRemoveStep Callback to remove a step by id.
 * @param onConfigure Callback to configure a step by id.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun AutomationBuilder(
    steps: List<AutomationStep>,
    selectedIndex: Int = -1,
    onSelectStep: (Int) -> Unit = {},
    onAddStep: () -> Unit = {},
    onRemoveStep: (String) -> Unit = {},
    onConfigure: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        LazyColumn {
            itemsIndexed(steps) { index, step ->
                val isSelected = index == selectedIndex

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectStep(index) },
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
                            text = "${index + 1}",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = step.type,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            )
                            Text(
                                text = if (step.config != null) "configured" else "unconfigured",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                // Connector between steps
                if (index < steps.lastIndex) {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "\u2502",
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                        Text(
                            text = "\u25BC",
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedButton(
            onClick = onAddStep,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(text = "+ Add Step")
        }
    }
}
