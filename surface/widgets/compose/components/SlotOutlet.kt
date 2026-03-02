// ============================================================
// Clef Surface Compose Widget — SlotOutlet
//
// Compose slot/portal system for Clef Surface. Provides named
// slot registration and rendering via CompositionLocal. Allows
// child components to fill named slots that are rendered
// elsewhere in the component tree.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

// --------------- Slot Registry ---------------

class SlotRegistry {
    private val slots = mutableStateMapOf<String, @Composable () -> Unit>()

    fun register(name: String, content: @Composable () -> Unit) {
        slots[name] = content
    }

    fun unregister(name: String) {
        slots.remove(name)
    }

    fun getSlot(name: String): (@Composable () -> Unit)? = slots[name]

    fun hasSlot(name: String): Boolean = name in slots

    val registeredSlots: Set<String> get() = slots.keys
}

val LocalSlotRegistry = compositionLocalOf { SlotRegistry() }

// --------------- SlotOutlet ---------------

@Composable
fun SlotOutlet(
    name: String,
    showEmpty: Boolean = false,
    emptyLabel: String? = null,
    modifier: Modifier = Modifier,
    fallback: (@Composable () -> Unit)? = null,
) {
    val registry = LocalSlotRegistry.current
    val slotContent = registry.getSlot(name)

    Box(modifier = modifier) {
        when {
            slotContent != null -> slotContent()
            fallback != null -> fallback()
            showEmpty -> {
                Text(
                    text = emptyLabel ?: "[slot: $name]",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

// --------------- SlotProvider ---------------

@Composable
fun SlotProvider(
    registry: SlotRegistry = remember { SlotRegistry() },
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    CompositionLocalProvider(LocalSlotRegistry provides registry) {
        Box(modifier = modifier) {
            content()
        }
    }
}

// --------------- SlotFill ---------------

@Composable
fun SlotFill(
    name: String,
    content: @Composable () -> Unit,
) {
    val registry = LocalSlotRegistry.current

    DisposableEffect(name) {
        registry.register(name, content)
        onDispose { registry.unregister(name) }
    }
}

// --------------- SlotFromConfig ---------------

@Composable
fun SlotFromConfig(
    config: SlotConfigData,
    showEmpty: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier) {
        config.slots.forEach { slotName ->
            SlotOutlet(
                name = slotName,
                showEmpty = showEmpty,
            )
        }
    }
}

data class SlotConfigData(
    val slots: List<String> = emptyList(),
)
