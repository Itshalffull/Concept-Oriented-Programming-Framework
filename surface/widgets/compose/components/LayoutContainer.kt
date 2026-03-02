// ============================================================
// Clef Surface Compose Widget — LayoutContainer
//
// Compose layout component that implements Clef Surface layout
// kinds (stack, grid, split, overlay, flow, sidebar, center)
// using Compose's Row, Column, LazyVerticalGrid, and Box.
// ============================================================

package clef.surface.compose.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// --------------- Layout Kinds ---------------

enum class LayoutKind {
    STACK, ROW, GRID, SPLIT, OVERLAY, FLOW, SIDEBAR, CENTER
}

// --------------- Component ---------------

@Composable
fun LayoutContainer(
    kind: LayoutKind = LayoutKind.STACK,
    gap: Dp = 8.dp,
    padding: Dp = 0.dp,
    gridColumns: Int = 2,
    splitRatio: Float = 0.5f,
    sidebarWidth: Dp = 240.dp,
    sidebarPosition: String = "start",
    crossAxisAlignment: Alignment.Horizontal = Alignment.Start,
    mainAxisAlignment: Arrangement.Vertical = Arrangement.Top,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    when (kind) {
        LayoutKind.STACK -> {
            Column(
                modifier = modifier.padding(padding),
                verticalArrangement = Arrangement.spacedBy(gap),
                horizontalAlignment = crossAxisAlignment,
            ) {
                content()
            }
        }
        LayoutKind.ROW -> {
            Row(
                modifier = modifier.padding(padding),
                horizontalArrangement = Arrangement.spacedBy(gap),
                verticalAlignment = Alignment.Top,
            ) {
                content()
            }
        }
        LayoutKind.GRID -> {
            LazyVerticalGrid(
                columns = GridCells.Fixed(gridColumns),
                modifier = modifier.padding(padding),
                horizontalArrangement = Arrangement.spacedBy(gap),
                verticalArrangement = Arrangement.spacedBy(gap),
            ) {
                // Grid items should be provided via content
            }
        }
        LayoutKind.SPLIT -> {
            Row(
                modifier = modifier
                    .fillMaxWidth()
                    .padding(padding),
                horizontalArrangement = Arrangement.spacedBy(gap),
            ) {
                Box(modifier = Modifier.weight(splitRatio)) {
                    content()
                }
                Box(modifier = Modifier.weight(1f - splitRatio)) {
                    // Second panel content
                }
            }
        }
        LayoutKind.OVERLAY -> {
            Box(
                modifier = modifier.padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                content()
            }
        }
        LayoutKind.FLOW -> {
            // FlowRow is available in Compose Foundation
            Row(
                modifier = modifier.padding(padding),
                horizontalArrangement = Arrangement.spacedBy(gap),
            ) {
                content()
            }
        }
        LayoutKind.SIDEBAR -> {
            Row(
                modifier = modifier
                    .fillMaxWidth()
                    .padding(padding),
                horizontalArrangement = Arrangement.spacedBy(gap),
            ) {
                if (sidebarPosition == "start") {
                    Box(modifier = Modifier.width(sidebarWidth)) { }
                    Box(modifier = Modifier.weight(1f)) { content() }
                } else {
                    Box(modifier = Modifier.weight(1f)) { content() }
                    Box(modifier = Modifier.width(sidebarWidth)) { }
                }
            }
        }
        LayoutKind.CENTER -> {
            Box(
                modifier = modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center,
            ) {
                content()
            }
        }
    }
}
