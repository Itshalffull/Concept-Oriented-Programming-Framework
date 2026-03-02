// ============================================================
// Clef Surface Ink Widget — Canvas
//
// Infinite two-dimensional spatial plane for placing and
// manipulating visual elements, adapted for terminal rendering.
// Displays a bordered area with coordinate and zoom info, and
// renders children within the canvas region.
//
// Adapts the canvas.widget spec: anatomy (root, viewport, grid,
// nodeLayer, edgeLayer, selectionBox, toolbar, minimap,
// propertyPanel), states, and connect attributes.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';
import type { ReactNode } from 'react';

// --------------- Props ---------------

export interface CanvasProps {
  /** Width of the canvas area in columns. */
  width?: number;
  /** Height of the canvas area in rows. */
  height?: number;
  /** Child elements to render within the canvas. */
  children?: ReactNode;
  /** Current zoom level. */
  zoom?: number;
  /** Horizontal pan offset. */
  panX?: number;
  /** Vertical pan offset. */
  panY?: number;
  /** Whether this widget currently has keyboard focus. */
  isFocused?: boolean;
}

// --------------- Component ---------------

export const Canvas: React.FC<CanvasProps> = ({
  width = 60,
  height = 20,
  children,
  zoom = 1.0,
  panX = 0,
  panY = 0,
  isFocused = false,
}) => {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <Box flexDirection="column">
      {/* Header bar */}
      <Box>
        <Text bold={isFocused} color={isFocused ? 'cyan' : undefined}>
          Canvas
        </Text>
        <Text dimColor>
          {' '}
          [{width}x{height}] zoom:{zoomPercent}% pan:({panX},{panY})
        </Text>
      </Box>

      {/* Canvas area */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={isFocused ? 'cyan' : 'gray'}
        width={width}
        height={height}
      >
        {children || (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <Text dimColor>(empty canvas)</Text>
          </Box>
        )}
      </Box>

      {/* Coordinate display */}
      <Box>
        <Text dimColor>
          origin: ({panX},{panY}) | {zoomPercent}%
        </Text>
      </Box>
    </Box>
  );
};

Canvas.displayName = 'Canvas';
export default Canvas;
