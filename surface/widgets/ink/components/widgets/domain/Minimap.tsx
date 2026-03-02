// ============================================================
// Clef Surface Ink Widget — Minimap
//
// Scaled-down overview of a larger document or canvas, rendered
// in the terminal using density block characters to represent
// content. Shows the current viewport position within the full
// document.
//
// Adapts the minimap.widget spec: anatomy (root, canvas,
// viewport, zoomControls, zoomIn, zoomOut, zoomFit, zoomLevel),
// states (idle, panning), and connect attributes.
// ============================================================

import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface MinimapProps {
  /** Lines of content to visualize. */
  content: string[];
  /** The currently visible line range. */
  visibleRange: { start: number; end: number };
  /** Total number of lines in the document. */
  totalLines: number;
  /** Width of the minimap in columns. */
  width?: number;
  /** Height of the minimap in rows. */
  height?: number;
}

// --------------- Helpers ---------------

function computeDensity(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return ' ';
  const ratio = trimmed.length / Math.max(line.length, 1);
  if (ratio > 0.7) return '\u2593';
  if (ratio > 0.3) return '\u2592';
  return '\u2591';
}

// --------------- Component ---------------

export const Minimap: React.FC<MinimapProps> = ({
  content,
  visibleRange,
  totalLines,
  width = 10,
  height = 15,
}) => {
  const minimapLines = useMemo(() => {
    if (totalLines === 0) return [];

    const linesPerRow = Math.max(1, Math.ceil(totalLines / height));
    const rows: string[] = [];

    for (let row = 0; row < height && row * linesPerRow < totalLines; row++) {
      const startLine = row * linesPerRow;
      const endLine = Math.min(startLine + linesPerRow, totalLines);

      // Build density string for this row
      let density = '';
      for (let col = 0; col < width; col++) {
        // Sample a representative line
        const sampleLine = startLine + Math.floor((endLine - startLine) * col / width);
        const line = content[sampleLine] || '';
        density += computeDensity(line);
      }

      rows.push(density);
    }

    return rows;
  }, [content, totalLines, width, height]);

  // Calculate viewport indicator position
  const linesPerRow = Math.max(1, Math.ceil(totalLines / height));
  const viewStart = Math.floor(visibleRange.start / linesPerRow);
  const viewEnd = Math.min(
    Math.ceil(visibleRange.end / linesPerRow),
    minimapLines.length
  );

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      {minimapLines.map((row, index) => {
        const isInViewport = index >= viewStart && index < viewEnd;

        return (
          <Box key={index}>
            <Text
              inverse={isInViewport}
              color={isInViewport ? 'cyan' : 'gray'}
            >
              {row}
            </Text>
            {isInViewport && index === viewStart && (
              <Text color="cyan"> {'\u25C0'}</Text>
            )}
          </Box>
        );
      })}

      {/* Position indicator */}
      <Box justifyContent="center">
        <Text dimColor>
          {visibleRange.start + 1}-{visibleRange.end}/{totalLines}
        </Text>
      </Box>
    </Box>
  );
};

Minimap.displayName = 'Minimap';
export default Minimap;
