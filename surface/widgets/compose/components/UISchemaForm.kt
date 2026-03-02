// ============================================================
// Clef Surface Compose Widget — UISchemaForm
//
// Compose form renderer driven by Clef Surface UISchema.
// Generates labeled inputs, selection prompts, and submit
// handling from schema definitions. Manages focus traversal,
// validation, and value collection across form fields.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class UISchemaFormConfig(
    val concept: String,
    val views: Map<String, UISchemaView>,
)

data class UISchemaView(
    val name: String,
    val fields: List<UISchemaField>,
)

data class UISchemaField(
    val name: String,
    val label: String,
    val element: String,
    val dataType: String? = null,
    val required: Boolean = false,
    val constraints: Map<String, Any>? = null,
)

// --------------- Component ---------------

@Composable
fun UISchemaForm(
    schema: UISchemaFormConfig,
    viewName: String = "create",
    initialValues: Map<String, Any?> = emptyMap(),
    initialErrors: Map<String, String> = emptyMap(),
    title: String? = null,
    showSubmit: Boolean = true,
    submitLabel: String = "Submit",
    showFieldNumbers: Boolean = false,
    fieldOptions: Map<String, List<OptionItem>> = emptyMap(),
    accentColor: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary,
    onSubmit: ((Map<String, Any?>) -> Unit)? = null,
    onChange: ((String, Any?) -> Unit)? = null,
    onValidate: ((String, Any?) -> String?)? = null,
    modifier: Modifier = Modifier,
) {
    val view = schema.views[viewName]
    val values = remember { mutableStateMapOf<String, Any?>().apply { putAll(initialValues) } }
    val errors = remember { mutableStateMapOf<String, String>().apply { putAll(initialErrors) } }
    var submitting by remember { mutableStateOf(false) }

    if (view == null) {
        Text(
            text = "View \"$viewName\" not found in schema for ${schema.concept}",
            color = MaterialTheme.colorScheme.error,
        )
        return
    }

    val formTitle = title ?: "${schema.concept} - ${view.name}"

    Column(
        modifier = modifier
            .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
            .padding(16.dp)
    ) {
        // Header
        Text(
            text = formTitle,
            style = MaterialTheme.typography.titleMedium,
            color = accentColor,
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Fields
        view.fields.forEachIndexed { index, field ->
            if (index > 0) {
                Divider(modifier = Modifier.padding(vertical = 8.dp))
            }

            Row {
                if (showFieldNumbers) {
                    Text(
                        text = "${index + 1}. ",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                ElementRenderer(
                    element = ElementConfig(
                        id = "${schema.concept}-${field.name}",
                        kind = field.element,
                        label = field.label,
                        dataType = field.dataType,
                        required = field.required,
                        constraints = field.constraints,
                    ),
                    value = values[field.name],
                    error = errors[field.name],
                    options = fieldOptions[field.name],
                    onChange = { newValue ->
                        values[field.name] = newValue
                        onChange?.invoke(field.name, newValue)
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }

        // Submit
        if (showSubmit) {
            Spacer(modifier = Modifier.height(16.dp))
            Divider()
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Button(
                    onClick = {
                        // Validate all fields
                        var valid = true
                        val newErrors = mutableMapOf<String, String>()
                        view.fields.forEach { field ->
                            if (field.required) {
                                val value = values[field.name]
                                if (value == null || value.toString().isBlank()) {
                                    newErrors[field.name] = "${field.label} is required"
                                    valid = false
                                }
                            }
                            onValidate?.invoke(field.name, values[field.name])?.let { error ->
                                newErrors[field.name] = error
                                valid = false
                            }
                        }
                        errors.clear()
                        errors.putAll(newErrors)
                        if (valid) {
                            submitting = true
                            onSubmit?.invoke(values.toMap())
                        }
                    },
                    enabled = !submitting,
                ) {
                    if (submitting) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(16.dp),
                            strokeWidth = 2.dp,
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("Submitting...")
                    } else {
                        Text(submitLabel)
                    }
                }

                if (errors.isNotEmpty()) {
                    Text(
                        text = "${errors.size} error${if (errors.size > 1) "s" else ""}",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
            }
        }
    }
}
