// ============================================================
// Clef Surface Compose Widget — Form
//
// Form container for Jetpack Compose managing submission
// lifecycle. Wraps children in a vertical Column layout and
// provides submit handling via a submit button. Maps form.widget
// anatomy (root, fields, actions, submitButton, resetButton,
// errorSummary) to Column with optional submit/reset buttons.
// See Architecture doc Section 16.
// ============================================================

package clef.surface.compose.components.widgets.navigation

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

/**
 * Form container with vertical field layout and action buttons.
 *
 * @param onSubmit Callback when the form is submitted.
 * @param onReset Callback when the form is reset.
 * @param submitLabel Label for the submit button.
 * @param resetLabel Label for the reset button.
 * @param showActions Whether to display action buttons.
 * @param modifier Modifier for the root layout.
 * @param content Form field and action children.
 */
@Composable
fun Form(
    onSubmit: (() -> Unit)? = null,
    onReset: (() -> Unit)? = null,
    submitLabel: String = "Submit",
    resetLabel: String = "Reset",
    showActions: Boolean = true,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        // Form fields
        content()

        // Action buttons
        if (showActions) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (onReset != null) {
                    OutlinedButton(onClick = onReset) {
                        Text(text = resetLabel)
                    }
                }
                if (onSubmit != null) {
                    Button(onClick = onSubmit) {
                        Text(text = submitLabel)
                    }
                }
            }
        }
    }
}
