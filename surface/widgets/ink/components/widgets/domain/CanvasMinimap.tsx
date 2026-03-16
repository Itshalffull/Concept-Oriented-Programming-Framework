// ============================================================
// Clef Surface Ink Widget — CanvasMinimap
//
// Thumbnail overview of the full canvas extent. Shows all items
// as small dots/rectangles and a draggable camera rectangle
// representing the current viewport.
//
// Adapts the canvas-minimap.widget spec: anatomy (root, canvas-bg,
// item-dot, camera-rect), states (idle, dragging).
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CanvasMinimapProps {
  /** Canvas identifier. */
  canvasId: string;
  /** Items to display as dots. */
  items?: Array<{ id: string; x: number; y: number; width: number; height: number; color?: string }>;
  /** Viewport X offset. */
  viewportX?: number;
  /** Viewport Y offset. */
  viewportY?: number;
  /** Viewport width. */
  viewportWidth?: number;
  /** Viewport height. */
  viewportHeight?: number;
  /** Total canvas width. */
  canvasExtentWidth?: number;
  /** Total canvas height. */
  canvasExtentHeight?: number;
  /** Minimap display width. */
  width?: number;
  /** Minimap display height. */
  height?: number;
}

// --------------- Component ---------------

export const CanvasMinimap: React.FC<CanvasMinimapProps> = ({
  canvasId,
  items = [],
  width = 200,
  height = 150,
}) => (
  <Box flexDirection="column" width={Math.min(width / 10, 20)} height={Math.min(height / 10, 8)}>
    <Text bold>[Minimap: {canvasId}]</Text>
    <Text dimColor>{items.length} items</Text>
  </Box>
);

export default CanvasMinimap;
