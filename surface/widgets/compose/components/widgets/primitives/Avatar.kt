// ============================================================
// Clef Surface Compose Widget — Avatar
//
// Displays a user or entity identity as initials inside a
// bordered circular surface. When no name is provided, falls
// back to a placeholder glyph. Size affects the diameter and
// text style.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Helpers ---------------

private enum class AvatarSize(val sizeDp: Int, val fontSp: Int) {
    SM(32, 12),
    MD(40, 14),
    LG(56, 20),
}

private fun parseSizeParam(size: String): AvatarSize = when (size) {
    "sm" -> AvatarSize.SM
    "lg" -> AvatarSize.LG
    else -> AvatarSize.MD
}

private fun getInitials(name: String): String {
    if (name.isBlank()) return "?"
    val parts = name.trim().split("\\s+".toRegex())
    return if (parts.size == 1) {
        parts[0].first().uppercaseChar().toString()
    } else {
        "${parts.first().first().uppercaseChar()}${parts.last().first().uppercaseChar()}"
    }
}

// --------------- Component ---------------

/**
 * Avatar composable that renders user/entity identity as initials
 * inside a circular surface.
 *
 * @param name Display name used to derive initials for the fallback.
 * @param src Image source URI — triggers loaded/error states.
 * @param size Size of the avatar: "sm", "md", or "lg".
 * @param fallback Custom fallback text when no name is available.
 * @param showFallback Force the fallback to display regardless of src.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun Avatar(
    name: String = "",
    src: String? = null,
    size: String = "md",
    fallback: String? = null,
    showFallback: Boolean = false,
    modifier: Modifier = Modifier,
) {
    var state by remember { mutableStateOf(if (src != null && !showFallback) "loading" else "error") }

    LaunchedEffect(src, showFallback) {
        if (src == null || showFallback) {
            state = "error"
        } else {
            // In a non-image-loading context, transition to error to
            // show the fallback, mirroring the spec loading -> error path.
            state = "loading"
            state = "error"
        }
    }

    val config = parseSizeParam(size)
    val displayText = fallback ?: getInitials(name)

    Box(
        modifier = modifier
            .size(config.sizeDp.dp)
            .clip(CircleShape)
            .background(
                color = MaterialTheme.colorScheme.secondaryContainer,
                shape = CircleShape,
            )
            .border(
                width = 1.dp,
                color = MaterialTheme.colorScheme.outline,
                shape = CircleShape,
            ),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = displayText,
            fontWeight = FontWeight.Bold,
            fontSize = config.fontSp.sp,
            color = MaterialTheme.colorScheme.onSecondaryContainer,
            textAlign = TextAlign.Center,
        )
    }
}
