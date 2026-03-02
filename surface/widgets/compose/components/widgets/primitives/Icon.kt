// ============================================================
// Clef Surface Compose Widget — Icon
//
// Renders a named icon using Material Icons in Compose. Maps
// common icon names to their Material Icons equivalents.
// Unknown names fall back to a generic diamond glyph rendered
// as text. Supports an accessible label for semantic icons.
//
// Adapts the icon.widget spec: anatomy (root), states (static),
// and connect attributes (data-part, data-icon, data-size,
// role, aria-hidden, aria-label) to Compose rendering.
// ============================================================

package clef.surface.compose.components.widgets.primitives

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// --------------- Icon Map ---------------

private val ICON_MAP: Map<String, ImageVector> = mapOf(
    "check" to Icons.Default.Check,
    "close" to Icons.Default.Close,
    "x" to Icons.Default.Close,
    "arrow-right" to Icons.Default.ArrowForward,
    "arrow-left" to Icons.Default.ArrowBack,
    "arrow-up" to Icons.Default.KeyboardArrowUp,
    "arrow-down" to Icons.Default.KeyboardArrowDown,
    "chevron-right" to Icons.Default.ChevronRight,
    "chevron-left" to Icons.Default.ChevronLeft,
    "chevron-up" to Icons.Default.ExpandLess,
    "chevron-down" to Icons.Default.ExpandMore,
    "plus" to Icons.Default.Add,
    "minus" to Icons.Default.Remove,
    "search" to Icons.Default.Search,
    "star" to Icons.Default.Star,
    "star-outline" to Icons.Default.StarBorder,
    "heart" to Icons.Default.Favorite,
    "heart-outline" to Icons.Default.FavoriteBorder,
    "info" to Icons.Default.Info,
    "warning" to Icons.Default.Warning,
    "error" to Icons.Default.Error,
    "success" to Icons.Default.CheckCircle,
    "home" to Icons.Default.Home,
    "settings" to Icons.Default.Settings,
    "edit" to Icons.Default.Edit,
    "delete" to Icons.Default.Delete,
    "trash" to Icons.Default.Delete,
    "copy" to Icons.Default.ContentCopy,
    "link" to Icons.Default.Link,
    "external-link" to Icons.Default.OpenInNew,
    "mail" to Icons.Default.Email,
    "lock" to Icons.Default.Lock,
    "unlock" to Icons.Default.LockOpen,
    "eye" to Icons.Default.Visibility,
    "eye-off" to Icons.Default.VisibilityOff,
    "menu" to Icons.Default.Menu,
    "more" to Icons.Default.MoreVert,
    "refresh" to Icons.Default.Refresh,
    "download" to Icons.Default.Download,
    "upload" to Icons.Default.Upload,
    "filter" to Icons.Default.FilterList,
    "sort" to Icons.Default.Sort,
    "calendar" to Icons.Default.CalendarToday,
    "clock" to Icons.Default.Schedule,
    "user" to Icons.Default.Person,
    "folder" to Icons.Default.Folder,
    "file" to Icons.Default.InsertDriveFile,
)

private const val FALLBACK_GLYPH = "\u25C6" // black diamond

// --------------- Helpers ---------------

private fun iconSizeDp(size: String): Float = when (size) {
    "sm" -> 16f
    "lg" -> 32f
    else -> 24f // md
}

// --------------- Component ---------------

/**
 * Icon composable that renders a named icon from the Material Icons
 * set, or a fallback Unicode glyph for unknown names. When [label]
 * is provided and [decorative] is false, the icon carries semantic
 * meaning for accessibility.
 *
 * @param name Named icon to render (e.g. "check", "home", "search").
 * @param size Size of the icon: "sm", "md", or "lg".
 * @param color Optional tint color for the icon.
 * @param label Accessible label making the icon semantic.
 * @param decorative Whether the icon is purely decorative.
 * @param modifier Compose modifier for the root element.
 */
@Composable
fun ClefIcon(
    name: String = "",
    size: String = "md",
    color: Color = LocalContentColor.current,
    label: String? = null,
    decorative: Boolean = true,
    modifier: Modifier = Modifier,
) {
    val imageVector = ICON_MAP[name.lowercase()]
    val sizeDp = iconSizeDp(size)
    val contentDesc = if (!decorative && label != null) label else null

    if (imageVector != null) {
        Icon(
            imageVector = imageVector,
            contentDescription = contentDesc,
            modifier = modifier.then(
                Modifier.size(sizeDp.dp)
            ),
            tint = color,
        )
    } else {
        // Fallback: render a Unicode glyph as text
        Text(
            text = FALLBACK_GLYPH,
            color = color,
            fontSize = sizeDp.sp,
            modifier = modifier.then(
                if (contentDesc != null) {
                    Modifier.semantics { contentDescription = contentDesc }
                } else {
                    Modifier
                }
            ),
        )
    }
}
