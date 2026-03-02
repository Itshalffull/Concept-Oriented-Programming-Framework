// ============================================================
// Clef Surface Compose Widget — RichTextEditor
//
// Multi-line text editing surface with a formatting toolbar.
// The toolbar Row provides toggle buttons for bold, italic,
// underline, and heading formatting. The editor area is an
// OutlinedTextField with markdown-style marker insertion.
// A status bar shows line count and character count.
//
// Adapts the rich-text-editor.widget spec: anatomy (root,
// toolbar, editor, placeholder), states (content, interaction,
// slashCommand), and connect attributes to Compose rendering
// with Material 3 styling.
// ============================================================

package clef.surface.compose.components.widgets.complexinputs

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FormatBold
import androidx.compose.material.icons.filled.FormatItalic
import androidx.compose.material.icons.filled.FormatUnderlined
import androidx.compose.material.icons.filled.Title
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

private enum class FormatAction(
    val icon: ImageVector,
    val label: String,
    val marker: String,
    val isBlock: Boolean = false,
) {
    BOLD(Icons.Filled.FormatBold, "Bold", "**"),
    ITALIC(Icons.Filled.FormatItalic, "Italic", "_"),
    UNDERLINE(Icons.Filled.FormatUnderlined, "Underline", "__"),
    HEADING(Icons.Filled.Title, "Heading", "# ", isBlock = true),
}

// --------------- Component ---------------

/**
 * RichTextEditor composable that provides a multi-line text editing
 * area with a formatting toolbar for bold, italic, underline, and
 * heading styles using markdown-style markers.
 *
 * @param value Current text content.
 * @param placeholder Placeholder text when empty.
 * @param showToolbar Whether to show the formatting toolbar.
 * @param enabled Whether the editor is enabled.
 * @param label Visible label above the editor.
 * @param onChange Callback when the content changes.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun RichTextEditor(
    value: String = "",
    placeholder: String = "Start typing...",
    showToolbar: Boolean = true,
    enabled: Boolean = true,
    label: String? = null,
    onChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var textFieldValue by remember { mutableStateOf(TextFieldValue(value)) }
    var activeFormats by remember { mutableStateOf(setOf<FormatAction>()) }

    LaunchedEffect(value) {
        if (value != textFieldValue.text) {
            textFieldValue = TextFieldValue(value)
        }
    }

    val currentText = textFieldValue.text
    val lineCount = currentText.count { it == '\n' } + 1
    val charCount = currentText.length

    val disabledAlpha = if (enabled) 1f else 0.38f

    Column(
        modifier = modifier.padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        // -- Label --
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = disabledAlpha),
            )
        }

        // -- Toolbar --
        if (showToolbar) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                FormatAction.entries.forEach { action ->
                    val isActive = action in activeFormats

                    IconToggleButton(
                        checked = isActive,
                        onCheckedChange = { checked ->
                            if (!enabled) return@IconToggleButton

                            activeFormats = if (checked) {
                                activeFormats + action
                            } else {
                                activeFormats - action
                            }

                            // Insert marker into text
                            val text = textFieldValue.text
                            val cursor = textFieldValue.selection.start
                            val newText = if (action.isBlock) {
                                // Toggle heading prefix on the current line
                                val lines = text.split("\n").toMutableList()
                                val linesBefore = text.substring(0, cursor).count { it == '\n' }
                                val lineIndex = linesBefore.coerceIn(0, lines.lastIndex)
                                if (lines[lineIndex].startsWith(action.marker)) {
                                    lines[lineIndex] = lines[lineIndex].removePrefix(action.marker)
                                } else {
                                    lines[lineIndex] = action.marker + lines[lineIndex]
                                }
                                lines.joinToString("\n")
                            } else {
                                text + action.marker
                            }

                            textFieldValue = TextFieldValue(newText)
                            onChange?.invoke(newText)
                        },
                        enabled = enabled,
                    ) {
                        Icon(
                            imageVector = action.icon,
                            contentDescription = action.label,
                            tint = if (isActive) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha)
                            },
                        )
                    }
                }
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 2.dp))
        }

        // -- Editor area --
        OutlinedTextField(
            value = textFieldValue,
            onValueChange = { tfv ->
                textFieldValue = tfv
                onChange?.invoke(tfv.text)
            },
            placeholder = { Text(placeholder) },
            enabled = enabled,
            minLines = 5,
            maxLines = 20,
            modifier = Modifier.fillMaxWidth(),
        )

        // -- Status bar --
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = "Lines: $lineCount",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )
            Text(
                text = "$charCount chars",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = disabledAlpha),
            )
        }
    }
}
