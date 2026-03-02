// ============================================================
// Clef Surface Compose Widget — ThemeSwitch
//
// Compose component that lets users toggle between available
// Clef Surface themes. Renders as a selectable list of theme
// options with the active theme highlighted.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp

// --------------- Component ---------------

@Composable
fun ThemeSwitch(
    themes: List<ThemeConfig> = emptyList(),
    activeTheme: String = "",
    label: String = "Theme",
    showPreview: Boolean = false,
    onThemeChange: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier,
) {
    var selectedTheme by remember(activeTheme) { mutableStateOf(activeTheme) }

    Column(
        modifier = modifier.semantics {
            contentDescription = "Theme switcher: $label"
        }
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
        )

        Spacer(modifier = Modifier.height(4.dp))

        themes.forEach { theme ->
            val isSelected = theme.name == selectedTheme

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        selectedTheme = theme.name
                        onThemeChange?.invoke(theme.name)
                    }
                    .padding(vertical = 2.dp)
            ) {
                RadioButton(
                    selected = isSelected,
                    onClick = {
                        selectedTheme = theme.name
                        onThemeChange?.invoke(theme.name)
                    }
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = theme.name,
                    style = if (isSelected) {
                        MaterialTheme.typography.bodyMedium
                    } else {
                        MaterialTheme.typography.bodyMedium
                    },
                    color = if (isSelected) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                )
            }
        }
    }
}
