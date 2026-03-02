// ============================================================
// Clef Surface Compose Widget — RadioCard
//
// Visual single-choice selection using rich card-style options.
// Each card renders inside a Material 3 OutlinedCard with a
// radio indicator, label, and optional description. Maps the
// radio-card.widget anatomy (root, label, items, card,
// cardContent, cardLabel, cardDescription) to Compose Card
// with RadioButton alignment.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class RadioCardOption(
    val label: String,
    val value: String,
    val description: String? = null,
)

// --------------- Component ---------------

@Composable
fun RadioCard(
    value: String?,
    options: List<RadioCardOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
) {
    Column(
        modifier = modifier,
    ) {
        options.forEachIndexed { index, option ->
            val isSelected = option.value == value

            OutlinedCard(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(enabled = enabled) { onValueChange(option.value) },
                border = BorderStroke(
                    width = if (isSelected) 2.dp else 1.dp,
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.outline
                    },
                ),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    RadioButton(
                        selected = isSelected,
                        onClick = null, // handled by card click
                        enabled = enabled,
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column {
                        Text(
                            text = option.label,
                            style = MaterialTheme.typography.titleMedium,
                            color = if (enabled) {
                                MaterialTheme.colorScheme.onSurface
                            } else {
                                MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
                            },
                        )
                        if (option.description != null) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = option.description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            if (index < options.lastIndex) {
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}
