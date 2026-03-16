// ============================================================
// Clef Surface Ink Widget — SpatialCanvasViewport
//
// Main viewport for the spatial canvas, handling pan, zoom, and
// item rendering within visible bounds.
// Adapts the spatial-canvas-viewport.widget spec.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface SpatialCanvasViewportProps {
  /** Canvas identifier. */
  canvasId: string;
  /** Current zoom level. */
  zoom?: number;
  /** Pan offset X. */
  panX?: number;
  /** Pan offset Y. */
  panY?: number;
  /** Viewport width. */
  width?: number;
  /** Viewport height. */
  height?: number;
  /** Whether grid is visible. */
  showGrid?: boolean;
}

// --------------- Component ---------------

export const SpatialCanvasViewport: React.FC<SpatialCanvasViewportProps> = ({
  canvasId,
  zoom = 1,
  panX = 0,
  panY = 0,
  width = 80,
  height = 24,
  showGrid = false,
}) => (
  <Box flexDirection="column" width={width} height={height}>
    <Text bold>Canvas: {canvasId} (zoom: {zoom.toFixed(1)}x, pan: {panX},{panY})</Text>
    {showGrid && <Text dimColor>Grid enabled</Text>}
  </Box>
);

export default SpatialCanvasViewport;
