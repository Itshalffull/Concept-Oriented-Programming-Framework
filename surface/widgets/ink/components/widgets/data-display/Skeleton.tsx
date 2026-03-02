// ============================================================
// Clef Surface Ink Widget — Skeleton
//
// Loading placeholder that mimics the shape of content being
// fetched. Renders pulsing or shimmering shapes in place of
// actual content to reduce perceived load time. Terminal
// adaptation: light block characters as shimmer placeholders,
// with animated cycling through characters.
// See widget spec: repertoire/widgets/data-display/skeleton.widget
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface SkeletonProps {
  /** Shape variant to render. */
  variant?: 'text' | 'circle' | 'rect';
  /** Width in characters. */
  width?: number;
  /** Height in rows (for rect variant). */
  height?: number;
  /** Number of text lines (for text variant). */
  lines?: number;
}

// --------------- Helpers ---------------

const SHIMMER_CHARS = ['\u2591', '\u2592', '\u2593', '\u2592']; // ░ ▒ ▓ ▒

// --------------- Component ---------------

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width = 20,
  height = 3,
  lines = 1,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % SHIMMER_CHARS.length);
    }, 300);
    return () => clearInterval(timer);
  }, []);

  const shimmerChar = SHIMMER_CHARS[frame];

  if (variant === 'circle') {
    // Approximate a circle in terminal as a small block
    const diameter = Math.min(width, 5);
    return (
      <Box flexDirection="column">
        {Array.from({ length: diameter }).map((_, row) => {
          // Simple circular mask approximation
          const halfD = diameter / 2;
          const y = row - halfD + 0.5;
          const xSpan = Math.round(Math.sqrt(Math.max(0, halfD * halfD - y * y)));
          const padding = halfD - xSpan;
          const chars = xSpan * 2;

          return (
            <Box key={`circle-${row}`}>
              <Text>{' '.repeat(Math.round(padding))}</Text>
              <Text dimColor>{shimmerChar.repeat(Math.max(1, Math.round(chars)))}</Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  if (variant === 'rect') {
    return (
      <Box flexDirection="column">
        {Array.from({ length: height }).map((_, row) => (
          <Box key={`rect-${row}`}>
            <Text dimColor>{shimmerChar.repeat(width)}</Text>
          </Box>
        ))}
      </Box>
    );
  }

  // Default: text variant
  return (
    <Box flexDirection="column">
      {Array.from({ length: lines }).map((_, lineIdx) => {
        // Last line is shorter to simulate natural text
        const lineWidth = lineIdx === lines - 1 && lines > 1
          ? Math.round(width * 0.6)
          : width;
        return (
          <Box key={`line-${lineIdx}`} marginBottom={lineIdx < lines - 1 ? 0 : 0}>
            <Text dimColor>{shimmerChar.repeat(lineWidth)}</Text>
          </Box>
        );
      })}
    </Box>
  );
};

Skeleton.displayName = 'Skeleton';
export default Skeleton;
