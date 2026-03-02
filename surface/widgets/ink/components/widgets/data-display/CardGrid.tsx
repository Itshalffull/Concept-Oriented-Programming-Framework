// ============================================================
// Clef Surface Ink Widget — CardGrid
//
// Responsive grid layout for displaying a collection of cards
// in a multi-column arrangement. Terminal adaptation: renders
// children in horizontal rows using flexWrap to simulate columns.
// See widget spec: repertoire/widgets/data-display/card-grid.widget
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface CardGridProps {
  /** Number of columns for the grid layout. */
  columns?: number;
  /** Gap between items (in characters). */
  gap?: number;
  /** Grid items to render. */
  children?: ReactNode;
}

// --------------- Component ---------------

export const CardGrid: React.FC<CardGridProps> = ({
  columns = 3,
  gap = 2,
  children,
}) => {
  const childArray = React.Children.toArray(children);

  if (childArray.length === 0) {
    return (
      <Box justifyContent="center" paddingY={1}>
        <Text dimColor>No items to display</Text>
      </Box>
    );
  }

  // Chunk children into rows based on column count
  const rows: ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += columns) {
    rows.push(childArray.slice(i, i + columns));
  }

  return (
    <Box flexDirection="column">
      {rows.map((row, rowIndex) => (
        <Box key={`grid-row-${rowIndex}`} flexDirection="row">
          {row.map((child, colIndex) => (
            <Box
              key={`grid-cell-${rowIndex}-${colIndex}`}
              flexGrow={1}
              flexBasis={0}
              marginRight={colIndex < row.length - 1 ? gap : 0}
              marginBottom={rowIndex < rows.length - 1 ? 1 : 0}
            >
              {child}
            </Box>
          ))}
          {/* Pad remaining columns to maintain alignment */}
          {row.length < columns &&
            Array.from({ length: columns - row.length }).map((_, padIndex) => (
              <Box
                key={`grid-pad-${rowIndex}-${padIndex}`}
                flexGrow={1}
                flexBasis={0}
                marginRight={padIndex < columns - row.length - 1 ? gap : 0}
              />
            ))}
        </Box>
      ))}
    </Box>
  );
};

CardGrid.displayName = 'CardGrid';
export default CardGrid;
