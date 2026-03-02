// ============================================================
// Clef Surface Compose Widget — MarkdownPreview
//
// Live markdown rendering widget. Transforms raw markdown source
// into a Column of styled Text elements: headings as bold text,
// bold/italic via TextStyle, bullets for lists, indented styled
// text for blockquotes, and monospace text for code blocks.
//
// Adapts the markdown-preview.widget spec: anatomy (root,
// content), states (static, rendering), and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Types ---------------

private sealed class RenderedLine {
    data class Heading(val level: Int, val content: String) : RenderedLine()
    data class BoldLine(val content: String) : RenderedLine()
    data class TextLine(val content: String) : RenderedLine()
    data class Bullet(val content: String) : RenderedLine()
    data class Quote(val content: String) : RenderedLine()
    data class Code(val content: String) : RenderedLine()
    object Hr : RenderedLine()
    object Blank : RenderedLine()
}

// --------------- Helpers ---------------

private fun parseMarkdown(source: String): List<RenderedLine> {
    val lines = source.split("\n")
    val result = mutableListOf<RenderedLine>()
    var inCodeBlock = false

    for (line in lines) {
        if (line.startsWith("```")) {
            inCodeBlock = !inCodeBlock
            if (inCodeBlock) {
                result.add(RenderedLine.Code("--- code ---"))
            }
            continue
        }

        if (inCodeBlock) {
            result.add(RenderedLine.Code(line))
            continue
        }

        val trimmed = line.trim()

        if (trimmed.isEmpty()) {
            result.add(RenderedLine.Blank)
            continue
        }

        // Headings
        val headingMatch = Regex("^(#{1,6})\\s+(.*)").find(trimmed)
        if (headingMatch != null) {
            result.add(
                RenderedLine.Heading(
                    level = headingMatch.groupValues[1].length,
                    content = headingMatch.groupValues[2],
                ),
            )
            continue
        }

        // Horizontal rule
        if (Regex("^[-*_]{3,}$").matches(trimmed)) {
            result.add(RenderedLine.Hr)
            continue
        }

        // Blockquote
        if (trimmed.startsWith("> ")) {
            result.add(RenderedLine.Quote(trimmed.drop(2)))
            continue
        }

        // Bullet list
        if (Regex("^[-*+]\\s").containsMatchIn(trimmed)) {
            result.add(RenderedLine.Bullet(trimmed.drop(2)))
            continue
        }

        // Numbered list
        val numberedMatch = Regex("^\\d+\\.\\s(.*)").find(trimmed)
        if (numberedMatch != null) {
            result.add(RenderedLine.Bullet(numberedMatch.groupValues[1]))
            continue
        }

        // Bold text line
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
            result.add(RenderedLine.BoldLine(trimmed.drop(2).dropLast(2)))
            continue
        }

        // Regular text
        result.add(RenderedLine.TextLine(trimmed))
    }

    return result
}

// --------------- Component ---------------

/**
 * Markdown preview rendered as a Column of styled Text elements.
 *
 * @param content Raw markdown content string.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun MarkdownPreview(
    content: String,
    modifier: Modifier = Modifier,
) {
    val parsed = remember(content) { parseMarkdown(content) }

    Column(modifier = modifier.padding(8.dp)) {
        parsed.forEach { line ->
            when (line) {
                is RenderedLine.Heading -> {
                    val fontSize = when (line.level) {
                        1 -> 24.sp
                        2 -> 20.sp
                        3 -> 18.sp
                        else -> 16.sp
                    }
                    Text(
                        text = line.content,
                        style = TextStyle(
                            fontSize = fontSize,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                        ),
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }

                is RenderedLine.BoldLine -> {
                    Text(
                        text = line.content,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }

                is RenderedLine.Bullet -> {
                    Row(modifier = Modifier.padding(start = 8.dp, top = 2.dp, bottom = 2.dp)) {
                        Text(
                            text = "\u2022",
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = line.content)
                    }
                }

                is RenderedLine.Quote -> {
                    Row(modifier = Modifier.padding(start = 16.dp, top = 2.dp, bottom = 2.dp)) {
                        Text(
                            text = "\u2502",
                            color = MaterialTheme.colorScheme.outlineVariant,
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = line.content,
                            fontStyle = FontStyle.Italic,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                is RenderedLine.Code -> {
                    Text(
                        text = line.content,
                        fontFamily = FontFamily.Monospace,
                        color = Color(0xFFDCDCAA),
                        modifier = Modifier.padding(start = 16.dp, top = 1.dp, bottom = 1.dp),
                    )
                }

                is RenderedLine.Hr -> {
                    Divider(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 8.dp),
                        color = MaterialTheme.colorScheme.outlineVariant,
                    )
                }

                is RenderedLine.Blank -> {
                    Spacer(modifier = Modifier.height(8.dp))
                }

                is RenderedLine.TextLine -> {
                    Text(
                        text = line.content,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
            }
        }
    }
}
