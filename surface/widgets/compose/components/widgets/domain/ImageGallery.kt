// ============================================================
// Clef Surface Compose Widget — ImageGallery
//
// Thumbnail grid displayed as a LazyVerticalGrid of Image or
// AsyncImage composables. Supports selection, optional captions,
// and a counter showing current position.
//
// Adapts the image-gallery.widget spec: anatomy (root, grid,
// thumbnail, lightbox, lightboxImage, prevButton, nextButton,
// counter, closeButton), states, and connect attributes.
// ============================================================

package clef.surface.compose.components.widgets.domain

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

// --------------- Types ---------------

data class GalleryImage(
    val src: String,
    val alt: String,
    val caption: String? = null,
)

// --------------- Component ---------------

/**
 * Image gallery displayed as a LazyVerticalGrid of thumbnails.
 *
 * @param images Array of images to display.
 * @param selectedIndex Index of the currently selected image.
 * @param columns Number of columns in the grid.
 * @param onSelect Callback when an image is selected.
 * @param modifier Modifier for the root layout.
 */
@Composable
fun ImageGallery(
    images: List<GalleryImage>,
    selectedIndex: Int = -1,
    columns: Int = 3,
    onSelect: (Int) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier.padding(8.dp)) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            itemsIndexed(images) { index, image ->
                val isSelected = index == selectedIndex

                Card(
                    modifier = Modifier
                        .clickable { onSelect(index) }
                        .then(
                            if (isSelected)
                                Modifier.border(
                                    3.dp,
                                    MaterialTheme.colorScheme.primary,
                                    RoundedCornerShape(12.dp),
                                )
                            else Modifier,
                        ),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    ),
                ) {
                    Column(
                        modifier = Modifier.padding(8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        // Placeholder for image (use AsyncImage with Coil in real app)
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                                .clip(RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                text = "\uD83D\uDDBC",
                                style = MaterialTheme.typography.headlineMedium,
                            )
                        }
                        Text(
                            text = image.alt,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        if (image.caption != null) {
                            Text(
                                text = image.caption,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        }

        // Counter
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "${if (selectedIndex >= 0) selectedIndex + 1 else 0} of ${images.size}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
