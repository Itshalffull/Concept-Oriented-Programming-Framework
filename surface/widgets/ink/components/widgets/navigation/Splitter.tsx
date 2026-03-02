// ============================================================
// Clef Surface Ink Widget — Splitter
//
// Resizable pane divider for terminal display.
// Renders children side-by-side (horizontal) or stacked
// (vertical) with a visual separator character between them.
// Maps splitter.widget anatomy (root, panelBefore, handle,
// panelAfter) to Ink Box/Text.
// See Architecture doc Section 16.
// ============================================================

import React from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface SplitterProps {
  /** Layout orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Size percentages for each child panel. */
  sizes?: number[];
  /** Minimum size in columns/rows for any panel. */
  minSize?: number;
  /** Child panels to divide. */
  children?: React.ReactNode;
}

// --------------- Component ---------------

export const Splitter: React.FC<SplitterProps> = ({
  orientation = 'horizontal',
  sizes = [50, 50],
  minSize: _minSize = 4,
  children,
}) => {
  const isHorizontal = orientation === 'horizontal';
  const childArray = React.Children.toArray(children);

  if (childArray.length === 0) return null;

  // If only one child, render it without a splitter
  if (childArray.length === 1) {
    return <Box flexDirection="column">{childArray[0]}</Box>;
  }

  const separator = isHorizontal ? (
    <Box flexDirection="column" alignItems="center">
      <Text dimColor>{'\u2502'}</Text>
    </Box>
  ) : (
    <Box>
      <Text dimColor>{'\u2500'.repeat(40)}</Text>
    </Box>
  );

  return (
    <Box flexDirection={isHorizontal ? 'row' : 'column'}>
      {childArray.map((child, index) => {
        const sizePercent = sizes[index] ?? Math.floor(100 / childArray.length);

        return (
          <React.Fragment key={index}>
            {index > 0 && separator}
            <Box
              flexDirection="column"
              width={isHorizontal ? `${sizePercent}%` : undefined}
              height={!isHorizontal ? `${sizePercent}%` : undefined}
            >
              {child}
            </Box>
          </React.Fragment>
        );
      })}
    </Box>
  );
};

Splitter.displayName = 'Splitter';
export default Splitter;
