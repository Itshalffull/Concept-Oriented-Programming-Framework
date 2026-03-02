// ============================================================
// Clef Surface Ink Widget — LayoutContainer
//
// Arranges child nodes using Ink's flexbox model. Maps Clef
// Surface LayoutConfig kinds to terminal layout patterns:
//
//   stack   → vertical/horizontal flex
//   grid    → column-width calculations
//   split   → two equal-width columns
//   flow    → horizontal wrap
//   sidebar → fixed-width + fluid column
//   center  → centered content
//   overlay → layered content (last child on top)
// ============================================================

import React, { type ReactNode } from 'react';
import { Box, Text } from 'ink';

import type { LayoutConfig, LayoutKind } from '../../shared/types.js';

// --------------- Gap Parsing ---------------

function parseGap(gap: string | undefined): number {
  if (!gap) return 0;
  if (/^\d+$/.test(gap)) return parseInt(gap, 10);
  const pxMatch = gap.match(/^(\d+)px$/);
  if (pxMatch) return Math.max(1, Math.round(parseInt(pxMatch[1], 10) / 8));
  const remMatch = gap.match(/^([\d.]+)rem$/);
  if (remMatch) return Math.max(1, Math.round(parseFloat(remMatch[1]) * 2));

  const tokenGaps: Record<string, number> = {
    'spacing.xs': 1, 'spacing.sm': 1, 'spacing.md': 2,
    'spacing.lg': 3, 'spacing.xl': 4, 'spacing.2xl': 6,
  };
  return tokenGaps[gap] ?? 1;
}

// --------------- Column Parsing ---------------

function parseColumns(columns: string | undefined, totalWidth: number): number[] {
  if (!columns) return [totalWidth];

  const repeatMatch = columns.match(/repeat\((\d+),\s*(.+)\)/);
  if (repeatMatch) {
    const count = parseInt(repeatMatch[1], 10);
    return Array(count).fill(Math.floor(totalWidth / count));
  }

  const parts = columns.split(/\s+/);
  let totalFr = 0;
  let totalFixed = 0;
  const parsed: Array<{ fr: number; fixed: number }> = [];

  for (const part of parts) {
    if (part.endsWith('fr')) {
      const fr = parseFloat(part);
      parsed.push({ fr, fixed: -1 });
      totalFr += fr;
    } else if (part.endsWith('px')) {
      const px = Math.max(1, Math.round(parseInt(part, 10) / 8));
      parsed.push({ fr: 0, fixed: px });
      totalFixed += px;
    } else {
      parsed.push({ fr: 0, fixed: Math.floor(totalWidth / parts.length) });
      totalFixed += Math.floor(totalWidth / parts.length);
    }
  }

  const remaining = Math.max(0, totalWidth - totalFixed);
  return parsed.map((p) =>
    p.fixed >= 0 ? p.fixed : Math.floor((p.fr / totalFr) * remaining),
  );
}

// --------------- Props ---------------

export interface LayoutContainerProps {
  /** Clef Surface layout configuration. */
  layout: LayoutConfig;
  /** Child nodes to arrange. */
  children: ReactNode;
  /** Available width in columns. */
  width?: number;
  /** Whether to show layout debug borders. */
  debug?: boolean;
}

// --------------- Terminal Width ---------------

function getTerminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns;
  }
  return 80;
}

// --------------- Component ---------------

export const LayoutContainer: React.FC<LayoutContainerProps> = ({
  layout,
  children,
  width = getTerminalWidth(),
  debug = false,
}) => {
  const gap = parseGap(layout.gap);
  const childArray = React.Children.toArray(children);

  switch (layout.kind) {
    case 'stack': {
      const direction = layout.direction || 'column';
      return (
        <Box
          flexDirection={direction}
          gap={gap}
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {children}
        </Box>
      );
    }

    case 'grid': {
      const columnWidths = parseColumns(layout.columns, width - gap);
      const rows: ReactNode[][] = [];
      let currentRow: ReactNode[] = [];

      for (const child of childArray) {
        currentRow.push(child);
        if (currentRow.length === columnWidths.length) {
          rows.push(currentRow);
          currentRow = [];
        }
      }
      if (currentRow.length > 0) rows.push(currentRow);

      return (
        <Box
          flexDirection="column"
          gap={gap}
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {rows.map((row, rowIndex) => (
            <Box key={rowIndex} flexDirection="row" gap={gap}>
              {row.map((cell, colIndex) => (
                <Box key={colIndex} width={columnWidths[colIndex]}>
                  {cell}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      );
    }

    case 'split': {
      const halfWidth = Math.floor((width - gap) / 2);
      return (
        <Box
          flexDirection="row"
          gap={gap}
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          <Box width={halfWidth}>{childArray[0]}</Box>
          <Box width={halfWidth}>{childArray[1]}</Box>
        </Box>
      );
    }

    case 'flow': {
      return (
        <Box
          flexDirection="row"
          flexWrap="wrap"
          gap={gap}
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {children}
        </Box>
      );
    }

    case 'sidebar': {
      const sidebarWidth = Math.min(30, Math.floor(width * 0.25));
      const mainWidth = width - sidebarWidth - gap;
      const isRightSidebar = layout.direction === 'row';

      return (
        <Box
          flexDirection="row"
          gap={gap}
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {isRightSidebar ? (
            <>
              <Box width={mainWidth}>{childArray[1]}</Box>
              <Box width={sidebarWidth}>{childArray[0]}</Box>
            </>
          ) : (
            <>
              <Box width={sidebarWidth}>{childArray[0]}</Box>
              <Box width={mainWidth}>{childArray[1]}</Box>
            </>
          )}
        </Box>
      );
    }

    case 'center': {
      return (
        <Box
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {children}
        </Box>
      );
    }

    case 'overlay': {
      // Terminal overlay: render children stacked vertically;
      // true overlapping is not possible in terminal
      return (
        <Box
          flexDirection="column"
          width={width}
          borderStyle={debug ? 'single' : undefined}
        >
          {children}
        </Box>
      );
    }

    default: {
      return (
        <Box flexDirection="column" gap={gap} width={width}>
          {children}
        </Box>
      );
    }
  }
};

LayoutContainer.displayName = 'LayoutContainer';
export default LayoutContainer;
