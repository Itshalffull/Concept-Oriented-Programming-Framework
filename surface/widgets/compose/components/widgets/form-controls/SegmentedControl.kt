// ============================================================
// Clef Surface Compose Widget — SegmentedControl
//
// Inline single-choice control displayed as a row of connected
// segments. The active segment is visually highlighted using
// Material 3 SegmentedButton styling. Maps the
// segmented-control.widget anatomy (root, items, item,
// itemLabel, indicator) to Material 3 SingleChoiceSegmentedButtonRow.
// ============================================================

package clef.surface.compose.components.widgets.formcontrols

import androidx.compose.foundation.layout.Column
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

// --------------- Types ---------------

data class SegmentedControlOption(
    val label: String,
    val value: String,
)

enum class SegmentedControlSize { Sm, Md, Lg }

// --------------- Component ---------------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SegmentedControl(
    value: String?,
    options: List<SegmentedControlOption>,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    size: SegmentedControlSize = SegmentedControlSize.Md,
    enabled: Boolean = true,
) {
    Column(modifier = modifier) {
        SingleChoiceSegmentedButtonRow {
            options.forEachIndexed { index, option ->
                SegmentedButton(
                    selected = option.value == value,
                    onClick = { if (enabled) onValueChange(option.value) },
                    shape = SegmentedButtonDefaults.itemShape(
                        index = index,
                        count = options.size,
                    ),
                    enabled = enabled,
                    label = {
                        Text(
                            text = option.label,
                            style = when (size) {
                                SegmentedControlSize.Sm -> MaterialTheme.typography.labelSmall
                                SegmentedControlSize.Md -> MaterialTheme.typography.labelLarge
                                SegmentedControlSize.Lg -> MaterialTheme.typography.titleSmall
                            },
                        )
                    },
                )
            }
        }
    }
}
