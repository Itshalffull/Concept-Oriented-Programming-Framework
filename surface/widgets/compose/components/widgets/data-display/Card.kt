// ============================================================
// Clef Surface Compose Widget — Card
//
// Surface container that groups related content and actions into
// a single visual unit. Supports header, body, and footer regions
// with configurable elevation, fill, and outline variants via
// Material 3 Card, ElevatedCard, and OutlinedCard.
// See widget spec: repertoire/widgets/data-display/card.widget
// ============================================================

package clef.surface.compose.components.widgets.datadisplay

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedCard
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

/** Card visual variant controlling border and elevation style. */
enum class CardVariant {
    Outline,
    Elevated,
    Filled,
}

/** Card size controlling internal padding. */
enum class CardSize {
    Sm,
    Md,
    Lg,
}

// --------------- Component ---------------

/**
 * Surface container grouping related content with header, body, and optional footer.
 *
 * @param title Primary heading text identifying the card content.
 * @param description Optional secondary text providing additional context.
 * @param variant Card variant controlling visual presentation.
 * @param size Size controlling internal padding.
 * @param modifier Modifier for the root card.
 * @param content Additional composable content rendered inside the card body.
 */
@Composable
fun Card(
    title: String? = null,
    description: String? = null,
    variant: CardVariant = CardVariant.Outline,
    size: CardSize = CardSize.Md,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit = {},
) {
    val innerPadding = when (size) {
        CardSize.Sm -> 8.dp
        CardSize.Md -> 16.dp
        CardSize.Lg -> 24.dp
    }

    val cardContent: @Composable () -> Unit = {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(innerPadding),
        ) {
            // Header: title and description
            if (title != null) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                )
                if (description != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(modifier = Modifier.height(12.dp))
            }

            // Body: caller-supplied content
            content()
        }
    }

    when (variant) {
        CardVariant.Outline -> {
            OutlinedCard(modifier = modifier.fillMaxWidth()) {
                cardContent()
            }
        }
        CardVariant.Elevated -> {
            ElevatedCard(
                modifier = modifier.fillMaxWidth(),
                elevation = CardDefaults.elevatedCardElevation(defaultElevation = 4.dp),
            ) {
                cardContent()
            }
        }
        CardVariant.Filled -> {
            androidx.compose.material3.Card(
                modifier = modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) {
                cardContent()
            }
        }
    }
}
