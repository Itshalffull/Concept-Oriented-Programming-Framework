// ============================================================
// Clef Surface Compose Widget — ToastManager
//
// Container that manages a stack of toast notifications.
// Controls ordering, maximum visible count, and lifecycle of
// individual toasts via SnackbarHostState. Renders toasts
// stacked vertically at a specified alignment position.
// Auto-dismisses toasts after their configured duration.
//
// Compose adaptation: SnackbarHostState wrapper that queues
// and displays toast items as custom Snackbars. Manages the
// toast lifecycle including auto-dismiss and action handling.
// See widget spec: repertoire/widgets/feedback/toast-manager.widget
// ============================================================

package clef.surface.compose.components.widgets.feedback

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// --------------- Types ---------------

/**
 * Represents a single toast notification managed by [ClefToastManager].
 *
 * @property id Unique identifier for the toast.
 * @property variant Visual variant controlling icon and color.
 * @property title Primary notification message.
 * @property description Optional secondary detail text.
 * @property duration Auto-dismiss duration in milliseconds. 0 to disable.
 */
data class ToastItem(
    val id: String,
    val variant: ToastVariant = ToastVariant.Info,
    val title: String,
    val description: String? = null,
    val duration: Long = 5000L,
)

// --------------- Toast Manager State ---------------

/**
 * State holder for managing a collection of toast notifications.
 * Create via [rememberToastManagerState].
 */
class ToastManagerState {
    private val _toasts = mutableStateListOf<ToastItem>()

    /** Current list of active toasts. */
    val toasts: List<ToastItem> get() = _toasts

    /** Add a toast to the stack. */
    fun show(toast: ToastItem) {
        _toasts.add(toast)
    }

    /** Remove a toast by its ID. */
    fun dismiss(id: String) {
        _toasts.removeAll { it.id == id }
    }

    /** Remove all toasts. */
    fun clear() {
        _toasts.clear()
    }
}

/**
 * Create and remember a [ToastManagerState] instance.
 */
@Composable
fun rememberToastManagerState(): ToastManagerState {
    return remember { ToastManagerState() }
}

// --------------- Component ---------------

/**
 * Container that manages and renders a stack of toast notifications.
 *
 * @param state The [ToastManagerState] controlling the toast lifecycle.
 * @param maxVisible Maximum number of visible toasts at once.
 * @param alignment Alignment of the toast stack within the parent layout.
 * @param modifier Modifier applied to the root Box.
 */
@Composable
fun ClefToastManager(
    state: ToastManagerState,
    maxVisible: Int = 5,
    alignment: Alignment = Alignment.BottomCenter,
    modifier: Modifier = Modifier,
) {
    val scope = rememberCoroutineScope()
    val visibleToasts = state.toasts.take(maxVisible)
    val overflowCount = (state.toasts.size - maxVisible).coerceAtLeast(0)

    // Set up auto-dismiss timers for each toast
    LaunchedEffect(visibleToasts.map { it.id }) {
        for (toast in visibleToasts) {
            if (toast.duration > 0) {
                scope.launch {
                    delay(toast.duration)
                    state.dismiss(toast.id)
                }
            }
        }
    }

    if (state.toasts.isEmpty()) return

    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = alignment,
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            // Toast stack
            visibleToasts.forEach { toast ->
                ClefToast(
                    variant = toast.variant,
                    title = toast.title,
                    description = toast.description,
                    onDismiss = { state.dismiss(toast.id) },
                )
            }

            // Overflow indicator
            if (overflowCount > 0) {
                Text(
                    text = "+$overflowCount more notification(s)",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
