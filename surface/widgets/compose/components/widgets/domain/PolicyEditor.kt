// ============================================================
// Clef Surface Compose Widget — PolicyEditor
//
// Access-control policy rule editor rendered as a LazyColumn
// of policy rule rows. Each row displays an ALLOW/DENY rule
// with subject, action, and resource fields. Supports adding,
// removing, and toggling rule effects.
//
// Adapts the policy-editor.widget spec: anatomy (root,
// modeToggle, visualEditor, serviceSelector, actionSelector,
// resourceSelector, jsonEditor, validateButton, simulatorButton),
// states, and connect attributes.
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
import androidx.compose.material.icons.filled.SwapHoriz
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class PolicyRule(
    val id: String,
    val subject: String,
    val action: String,
    val resource: String,
    val effect: String, // "ALLOW" or "DENY"
)

// --------------- Component ---------------

/**
 * Policy rule editor with a list of ALLOW/DENY rules.
 *
 * @param rules List of policy rules.
 * @param selectedIndex Index of the currently selected rule.
 * @param onSelectRule Callback when a rule row is tapped.
 * @param onAdd Callback to add a new rule.
 * @param onRemove Callback to remove a rule by id.
 * @param onToggleEffect Callback to toggle a rule between ALLOW and DENY.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun PolicyEditor(
    rules: List<PolicyRule>,
    selectedIndex: Int = -1,
    onSelectRule: (Int) -> Unit = {},
    onAdd: () -> Unit = {},
    onRemove: (String) -> Unit = {},
    onToggleEffect: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Policy Rules",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = " (${rules.size} rules)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            itemsIndexed(rules) { index, rule ->
                val isSelected = index == selectedIndex
                val effectColor = if (rule.effect == "ALLOW") Color(0xFF4CAF50) else Color(0xFFF44336)

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelectRule(index) },
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
                            text = rule.effect,
                            fontWeight = FontWeight.Bold,
                            color = effectColor,
                            style = MaterialTheme.typography.labelLarge,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = rule.subject,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = rule.action,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.tertiary,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = rule.resource,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = { onToggleEffect(rule.id) }) {
                            Icon(
                                imageVector = Icons.Default.SwapHoriz,
                                contentDescription = "Toggle ALLOW/DENY",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        IconButton(onClick = { onRemove(rule.id) }) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Remove rule",
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
            Text(text = "+ Add Rule")
        }
    }
}
