// ============================================================
// Clef Surface Ink Widget — LayoutContainer
//
// Arranges child nodes using Ink's flexbox-in-terminal model.
// Maps Clef Surface LayoutConfig kinds to terminal layout patterns:
//
//   stack  → vertical/horizontal flex with spacer-based gaps
//   grid   → character-width column calculations
//   split  → two equal-width columns
//   flow   → horizontal wrap at terminal width
//   sidebar → fixed-width + fluid column
//   center → centered content with padding
//   overlay → layered content (last child on top)
// ============================================================

import type { LayoutConfig, LayoutKind } from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_DIM = '\x1b[2m';

// --- Gap Parsing ---

/**
 * Parse a Clef Surface gap value to a character count for terminal spacing.
 * Handles token references (e.g., "spacing.md"), px values, rem values,
 * or plain numbers.
 */
function parseGap(gap: string | undefined): number {
  if (!gap) return 0;

  // Plain number
  if (/^\d+$/.test(gap)) return parseInt(gap, 10);

  // Pixel values: "16px" → approximate to chars (assume ~8px per char)
  const pxMatch = gap.match(/^(\d+)px$/);
  if (pxMatch) return Math.max(1, Math.round(parseInt(pxMatch[1], 10) / 8));

  // Rem values: "1rem" → approximate (1rem ≈ 2 chars)
  const remMatch = gap.match(/^([\d.]+)rem$/);
  if (remMatch) return Math.max(1, Math.round(parseFloat(remMatch[1]) * 2));

  // Token references: "spacing.xs" → map to reasonable defaults
  const tokenGaps: Record<string, number> = {
    'spacing.xs': 1,
    'spacing.sm': 1,
    'spacing.md': 2,
    'spacing.lg': 3,
    'spacing.xl': 4,
    'spacing.2xl': 6,
  };
  if (tokenGaps[gap] !== undefined) return tokenGaps[gap];

  // Default fallback
  return 1;
}

// --- Grid Column Parsing ---

/**
 * Parse CSS grid column definitions to character-width columns.
 * Handles: "1fr 1fr", "200px 1fr", "repeat(3, 1fr)", etc.
 */
function parseColumns(columns: string | undefined, totalWidth: number): number[] {
  if (!columns) return [totalWidth];

  // Handle repeat()
  const repeatMatch = columns.match(/repeat\((\d+),\s*(.+)\)/);
  if (repeatMatch) {
    const count = parseInt(repeatMatch[1], 10);
    const template = repeatMatch[2].trim();
    const col = parseSingleColumn(template, totalWidth, count);
    return Array(count).fill(col);
  }

  const parts = columns.split(/\s+/);
  const frParts: number[] = [];
  const fixedParts: number[] = [];
  let totalFixed = 0;
  let totalFr = 0;

  for (const part of parts) {
    if (part.endsWith('fr')) {
      const fr = parseFloat(part);
      frParts.push(fr);
      fixedParts.push(-1); // Marker for fr
      totalFr += fr;
    } else {
      const px = parseSingleColumn(part, totalWidth, parts.length);
      frParts.push(0);
      fixedParts.push(px);
      totalFixed += px;
    }
  }

  const remainingWidth = Math.max(0, totalWidth - totalFixed);
  const result: number[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (fixedParts[i] >= 0) {
      result.push(fixedParts[i]);
    } else {
      result.push(Math.floor((frParts[i] / totalFr) * remainingWidth));
    }
  }

  return result;
}

function parseSingleColumn(spec: string, totalWidth: number, count: number): number {
  if (spec.endsWith('fr')) {
    return Math.floor(totalWidth / count);
  }
  if (spec.endsWith('px')) {
    return Math.max(1, Math.round(parseInt(spec, 10) / 8));
  }
  if (/^\d+$/.test(spec)) {
    return parseInt(spec, 10);
  }
  return Math.floor(totalWidth / count);
}

// --- LayoutContainer Props ---

export interface LayoutContainerProps {
  /** Clef Surface layout configuration. */
  layout: LayoutConfig;
  /** Child nodes to arrange. */
  children: (TerminalNode | string)[];
  /** Available width in columns (defaults to terminal width). */
  width?: number;
  /** Available height in rows (optional constraint). */
  height?: number;
  /** Whether to show layout debug borders. */
  debug?: boolean;
}

/**
 * Creates a LayoutContainer terminal node.
 *
 * Translates Clef Surface LayoutConfig to terminal-compatible flexbox
 * layout using character-width calculations and spacer nodes.
 */
export function createLayoutContainer(props: LayoutContainerProps): TerminalNode {
  const {
    layout,
    children,
    width = getTerminalWidth(),
    height,
    debug = false,
  } = props;

  const gap = parseGap(layout.gap);

  switch (layout.kind) {
    case 'stack':
      return createStackLayout(layout, children, gap, width, debug);

    case 'grid':
      return createGridLayout(layout, children, gap, width, debug);

    case 'split':
      return createSplitLayout(layout, children, gap, width, debug);

    case 'flow':
      return createFlowLayout(layout, children, gap, width, debug);

    case 'sidebar':
      return createSidebarLayout(layout, children, gap, width, debug);

    case 'center':
      return createCenterLayout(layout, children, width, debug);

    case 'overlay':
      return createOverlayLayout(layout, children, width, debug);

    default:
      // Fallback: vertical stack
      return createStackLayout(
        { ...layout, kind: 'stack', direction: 'column' },
        children, gap, width, debug,
      );
  }
}

// --- Layout Kind Implementations ---

function createStackLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  gap: number,
  width: number,
  debug: boolean,
): TerminalNode {
  const direction = layout.direction || 'column';
  const result: (TerminalNode | string)[] = [];

  for (let i = 0; i < children.length; i++) {
    result.push(children[i]);

    // Insert spacer between children (not after last)
    if (i < children.length - 1 && gap > 0) {
      if (direction === 'column') {
        // Vertical spacer: empty lines
        result.push({
          type: 'spacer',
          props: { height: gap, direction: 'vertical' },
          children: [],
        });
      } else {
        // Horizontal spacer: space characters
        result.push({
          type: 'spacer',
          props: { width: gap, direction: 'horizontal' },
          children: [],
        });
      }
    }
  }

  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'stack',
      flexDirection: direction,
      width,
      debug,
    },
    children: result,
  };
}

function createGridLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  gap: number,
  width: number,
  debug: boolean,
): TerminalNode {
  const columnWidths = parseColumns(layout.columns, width - gap);
  const rows: (TerminalNode | string)[][] = [];

  // Distribute children into grid rows
  let currentRow: (TerminalNode | string)[] = [];
  for (let i = 0; i < children.length; i++) {
    currentRow.push(children[i]);
    if (currentRow.length === columnWidths.length) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const result: (TerminalNode | string)[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];

    // Build a row node containing cells with proper widths
    const rowChildren: (TerminalNode | string)[] = [];
    for (let colIndex = 0; colIndex < row.length; colIndex++) {
      rowChildren.push({
        type: 'box',
        props: {
          role: 'grid-cell',
          width: columnWidths[colIndex] || Math.floor(width / columnWidths.length),
          column: colIndex,
          row: rowIndex,
        },
        children: [row[colIndex]],
      });

      // Gap between columns
      if (colIndex < row.length - 1 && gap > 0) {
        rowChildren.push({
          type: 'spacer',
          props: { width: gap, direction: 'horizontal' },
          children: [],
        });
      }
    }

    result.push({
      type: 'box',
      props: { role: 'grid-row', flexDirection: 'row', row: rowIndex },
      children: rowChildren,
    });

    // Gap between rows
    if (rowIndex < rows.length - 1 && gap > 0) {
      result.push({
        type: 'spacer',
        props: { height: gap, direction: 'vertical' },
        children: [],
      });
    }
  }

  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'grid',
      flexDirection: 'column',
      width,
      columns: columnWidths,
      debug,
    },
    children: result,
  };
}

function createSplitLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  gap: number,
  width: number,
  debug: boolean,
): TerminalNode {
  const halfWidth = Math.floor((width - gap) / 2);

  const leftChild = children[0] || '';
  const rightChild = children[1] || '';

  const rowChildren: (TerminalNode | string)[] = [
    {
      type: 'box',
      props: { role: 'split-left', width: halfWidth },
      children: [leftChild],
    },
  ];

  if (gap > 0) {
    rowChildren.push({
      type: 'spacer',
      props: { width: gap, direction: 'horizontal' },
      children: [],
    });
  }

  rowChildren.push({
    type: 'box',
    props: { role: 'split-right', width: halfWidth },
    children: [rightChild],
  });

  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'split',
      flexDirection: 'row',
      width,
      debug,
    },
    children: rowChildren,
  };
}

function createFlowLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  gap: number,
  width: number,
  debug: boolean,
): TerminalNode {
  // Flow layout: wrap children horizontally
  // Since we cannot dynamically measure terminal node widths at build time,
  // we arrange them in a row and annotate with flex-wrap
  const result: (TerminalNode | string)[] = [];

  for (let i = 0; i < children.length; i++) {
    result.push(children[i]);
    if (i < children.length - 1 && gap > 0) {
      result.push({
        type: 'spacer',
        props: { width: gap, direction: 'horizontal' },
        children: [],
      });
    }
  }

  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'flow',
      flexDirection: 'row',
      flexWrap: 'wrap',
      width,
      gap,
      debug,
    },
    children: result,
  };
}

function createSidebarLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  gap: number,
  width: number,
  debug: boolean,
): TerminalNode {
  // Default sidebar width: 30 characters or ~25% of terminal
  const sidebarWidth = Math.min(30, Math.floor(width * 0.25));
  const mainWidth = width - sidebarWidth - gap;

  const isRightSidebar = layout.direction === 'row';
  const sidebarChild = children[0] || '';
  const mainChild = children[1] || '';

  const rowChildren: (TerminalNode | string)[] = [];

  if (isRightSidebar) {
    // Main content first, sidebar on right
    rowChildren.push({
      type: 'box',
      props: { role: 'sidebar-main', width: mainWidth },
      children: [mainChild],
    });
    if (gap > 0) {
      rowChildren.push({
        type: 'spacer',
        props: { width: gap, direction: 'horizontal' },
        children: [],
      });
    }
    rowChildren.push({
      type: 'box',
      props: { role: 'sidebar-aside', width: sidebarWidth },
      children: [sidebarChild],
    });
  } else {
    // Sidebar on left, main content right
    rowChildren.push({
      type: 'box',
      props: { role: 'sidebar-aside', width: sidebarWidth },
      children: [sidebarChild],
    });
    if (gap > 0) {
      rowChildren.push({
        type: 'spacer',
        props: { width: gap, direction: 'horizontal' },
        children: [],
      });
    }
    rowChildren.push({
      type: 'box',
      props: { role: 'sidebar-main', width: mainWidth },
      children: [mainChild],
    });
  }

  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'sidebar',
      flexDirection: 'row',
      width,
      sidebarWidth,
      debug,
    },
    children: rowChildren,
  };
}

function createCenterLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  width: number,
  debug: boolean,
): TerminalNode {
  // Center layout: add horizontal spacers around content
  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'center',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width,
      debug,
    },
    children,
  };
}

function createOverlayLayout(
  layout: LayoutConfig,
  children: (TerminalNode | string)[],
  width: number,
  debug: boolean,
): TerminalNode {
  // Overlay layout: stack children with z-index semantics
  // In terminal, last child "overlays" (rendered last, visible on top)
  return {
    type: 'box',
    props: {
      role: 'layout-container',
      layoutKind: 'overlay',
      position: 'relative',
      width,
      debug,
    },
    children: children.map((child, index) => {
      if (typeof child === 'string') return child;
      return {
        ...child,
        props: {
          ...child.props,
          zIndex: index,
          position: index > 0 ? 'absolute' : 'relative',
        },
      };
    }),
  };
}

// --- Terminal Width Helper ---

function getTerminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns;
  }
  return 80; // Default fallback
}

/** Get the current terminal dimensions. */
export function getTerminalSize(): { columns: number; rows: number } {
  if (typeof process !== 'undefined' && process.stdout) {
    return {
      columns: process.stdout.columns || 80,
      rows: process.stdout.rows || 24,
    };
  }
  return { columns: 80, rows: 24 };
}
