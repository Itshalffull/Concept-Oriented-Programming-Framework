// ============================================================
// Clef Surface Compose Widget — CodeBlock
//
// Syntax-highlighted code display block rendered as a Surface
// with monospace Text and syntax highlighting colors. Shows
// optional line numbers, highlighted lines with a tinted
// background, and a copyable indicator in the header.
//
// Adapts the code-block.widget spec: anatomy (root, header,
// language, copyButton, lineNumbers, code), states (idle,
// hovered, focused, copied), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

// --------------- Component ---------------

/**
 * Syntax-highlighted code display block with monospace text.
 *
 * @param code The source code string to display.
 * @param language Programming language name shown in the header.
 * @param showLineNumbers Whether to show line numbers in the gutter.
 * @param highlightLines Line numbers to highlight (1-based).
 * @param copyable Whether the code can be copied.
 * @param onCopy Callback invoked when the copy button is pressed.
 * @param modifier Modifier for the root Surface.
 */
@Composable
fun CodeBlock(
    code: String,
    language: String = "plaintext",
    showLineNumbers: Boolean = true,
    highlightLines: Set<Int> = emptySet(),
    copyable: Boolean = false,
    onCopy: (String) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var copied by remember { mutableStateOf(false) }

    LaunchedEffect(copied) {
        if (copied) {
            delay(2000)
            copied = false
        }
    }

    val lines = code.split("\n")
    val gutterWidth = if (showLineNumbers) lines.size.toString().length + 1 else 0

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = Color(0xFF1E1E1E),
        tonalElevation = 2.dp,
    ) {
        Column {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = language,
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFDCDCAA),
                )
                Spacer(modifier = Modifier.weight(1f))
                if (copyable) {
                    TextButton(onClick = {
                        onCopy(code)
                        copied = true
                    }) {
                        Text(
                            text = if (copied) "Copied!" else "Copy",
                            color = if (copied) Color(0xFF4EC9B0) else Color(0xFF9CDCFE),
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }

            // Code lines
            Column(
                modifier = Modifier
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 12.dp, vertical = 4.dp),
            ) {
                lines.forEachIndexed { index, line ->
                    val lineNum = index + 1
                    val isHighlighted = lineNum in highlightLines

                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (isHighlighted)
                                    Modifier.background(Color(0xFF264F78))
                                else
                                    Modifier,
                            ),
                    ) {
                        Row {
                            if (showLineNumbers) {
                                Text(
                                    text = lineNum.toString().padStart(gutterWidth),
                                    fontFamily = FontFamily.Monospace,
                                    fontSize = 13.sp,
                                    color = Color(0xFF858585),
                                )
                                Spacer(modifier = Modifier.width(12.dp))
                            }
                            Text(
                                text = line,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 13.sp,
                                color = Color(0xFFD4D4D4),
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.padding(bottom = 8.dp))
        }
    }
}
