// ============================================================
// Clef Surface Ink Widget — ElevationBox
//
// Terminal box with border styling that varies by elevation level.
// Since terminals cannot render CSS shadows, elevation is
// communicated via border character weight:
//
//   Level 0: No border
//   Level 1: Light dots (┄)
//   Level 2: Single lines (─│┌┐└┘)
//   Level 3: Double lines (═║╔╗╚╝)
//   Level 4: Heavy/thick lines (━┃┏┓┗┛)
//   Level 5: Heavy + shadow characters (▀▄)
// ============================================================

import type { ElevationLevel } from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg, hexToAnsiBg } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';

// --- Border Character Sets by Elevation ---

interface BorderCharSet {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

const BORDER_NONE: BorderCharSet = {
  topLeft: '', topRight: '', bottomLeft: '', bottomRight: '',
  horizontal: '', vertical: '',
};

const BORDER_DOTTED: BorderCharSet = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2504', // ┄
  vertical: '\u2506',   // ┆
};

const BORDER_SINGLE: BorderCharSet = {
  topLeft: '\u250c', topRight: '\u2510',
  bottomLeft: '\u2514', bottomRight: '\u2518',
  horizontal: '\u2500', // ─
  vertical: '\u2502',   // │
};

const BORDER_DOUBLE: BorderCharSet = {
  topLeft: '\u2554', topRight: '\u2557',
  bottomLeft: '\u255a', bottomRight: '\u255d',
  horizontal: '\u2550', // ═
  vertical: '\u2551',   // ║
};

const BORDER_HEAVY: BorderCharSet = {
  topLeft: '\u250f', topRight: '\u2513',
  bottomLeft: '\u2517', bottomRight: '\u251b',
  horizontal: '\u2501', // ━
  vertical: '\u2503',   // ┃
};

const BORDER_HEAVY_SHADOW: BorderCharSet = {
  topLeft: '\u250f', topRight: '\u2513',
  bottomLeft: '\u2517', bottomRight: '\u251b',
  horizontal: '\u2501', // ━
  vertical: '\u2503',   // ┃
};

const ELEVATION_BORDERS: Record<ElevationLevel, BorderCharSet> = {
  0: BORDER_NONE,
  1: BORDER_DOTTED,
  2: BORDER_SINGLE,
  3: BORDER_DOUBLE,
  4: BORDER_HEAVY,
  5: BORDER_HEAVY_SHADOW,
};

// --- ANSI Styling per Elevation ---

const ELEVATION_ANSI: Record<ElevationLevel, string> = {
  0: '',
  1: ANSI_DIM,
  2: '',
  3: '',
  4: ANSI_BOLD,
  5: ANSI_BOLD,
};

// --- Shadow Characters for Level 5 ---

const SHADOW_BOTTOM = '\u2584'; // ▄
const SHADOW_RIGHT = '\u2588';  // █
const SHADOW_CORNER = '\u2584'; // ▄

// --- ElevationBox Props ---

export interface ElevationBoxProps {
  /** Elevation level (0-5). */
  level: ElevationLevel;
  /** Child nodes to render inside the box. */
  children: (TerminalNode | string)[];
  /** Width of the box in columns (including borders). */
  width?: number;
  /** Title text in the top border. */
  title?: string;
  /** Padding inside the box (in character cells). */
  padding?: number;
  /** Border color as hex. */
  borderColor?: string;
  /** Shadow color as hex (for level 5). */
  shadowColor?: string;
  /** Background color as hex. */
  backgroundColor?: string;
  /** Whether to auto-size width to content. */
  autoWidth?: boolean;
}

/**
 * Creates an ElevationBox terminal node.
 *
 * Renders a bordered box where the border style communicates
 * the elevation level in the terminal.
 */
export function createElevationBox(props: ElevationBoxProps): TerminalNode {
  const {
    level,
    children,
    width = 40,
    title,
    padding = 1,
    borderColor,
    shadowColor = '#444444',
    backgroundColor,
    autoWidth = false,
  } = props;

  const border = ELEVATION_BORDERS[level];
  const ansiStyle = ELEVATION_ANSI[level];
  const borderAnsi = borderColor ? hexToAnsiFg(borderColor) : '';
  const bgAnsi = backgroundColor ? hexToAnsiBg(backgroundColor) : '';

  // Level 0: no border, just render children
  if (level === 0) {
    return {
      type: 'box',
      props: {
        role: 'elevation-box',
        level: 0,
        flexDirection: 'column',
      },
      children,
    };
  }

  const innerWidth = width - 2; // Subtract border columns
  const paddedWidth = innerWidth - (padding * 2);
  const result: (TerminalNode | string)[] = [];

  // Top border
  let topLine = `${borderAnsi}${ansiStyle}${border.topLeft}`;
  if (title) {
    const titleDisplay = ` ${title} `;
    const remainingWidth = innerWidth - titleDisplay.length;
    const leftFill = Math.max(1, Math.floor(remainingWidth / 2));
    const rightFill = Math.max(1, remainingWidth - leftFill);
    topLine += border.horizontal.repeat(leftFill);
    topLine += `${ANSI_RESET}${ANSI_BOLD}${titleDisplay}${ANSI_RESET}${borderAnsi}${ansiStyle}`;
    topLine += border.horizontal.repeat(rightFill);
  } else {
    topLine += border.horizontal.repeat(innerWidth);
  }
  topLine += `${border.topRight}${ANSI_RESET}`;

  result.push({ type: 'text', props: { role: 'border-top' }, children: [topLine] });

  // Padding top
  for (let i = 0; i < padding; i++) {
    const paddingLine = `${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}${bgAnsi}${' '.repeat(innerWidth)}${ANSI_RESET}${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}`;
    result.push({ type: 'text', props: { role: 'padding' }, children: [paddingLine] });
  }

  // Content lines - wrap each child in border verticals
  for (const child of children) {
    const leftBorder = `${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}${bgAnsi}${' '.repeat(padding)}`;
    const rightPad = `${' '.repeat(padding)}${ANSI_RESET}${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}`;

    result.push({
      type: 'box',
      props: {
        role: 'elevation-content-line',
        flexDirection: 'row',
        prefixStr: leftBorder,
        suffixStr: rightPad,
        contentWidth: paddedWidth,
      },
      children: [
        typeof child === 'string' ? child : child,
      ],
    });
  }

  // Padding bottom
  for (let i = 0; i < padding; i++) {
    const paddingLine = `${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}${bgAnsi}${' '.repeat(innerWidth)}${ANSI_RESET}${borderAnsi}${ansiStyle}${border.vertical}${ANSI_RESET}`;
    result.push({ type: 'text', props: { role: 'padding' }, children: [paddingLine] });
  }

  // Bottom border
  let bottomLine = `${borderAnsi}${ansiStyle}${border.bottomLeft}`;
  bottomLine += border.horizontal.repeat(innerWidth);
  bottomLine += `${border.bottomRight}${ANSI_RESET}`;
  result.push({ type: 'text', props: { role: 'border-bottom' }, children: [bottomLine] });

  // Level 5: Add shadow effect
  if (level === 5) {
    const shadowAnsi = hexToAnsiFg(shadowColor);
    const shadowLine = ` ${shadowAnsi}${SHADOW_BOTTOM.repeat(width)}${ANSI_RESET}`;
    result.push({ type: 'text', props: { role: 'shadow' }, children: [shadowLine] });
  }

  return {
    type: 'box',
    props: {
      role: 'elevation-box',
      level,
      borderStyle: getBorderStyleName(level),
      flexDirection: 'column',
      width,
    },
    children: result,
  };
}

/** Map elevation level to a descriptive border style name. */
function getBorderStyleName(level: ElevationLevel): string {
  switch (level) {
    case 0: return 'none';
    case 1: return 'dotted';
    case 2: return 'single';
    case 3: return 'double';
    case 4: return 'heavy';
    case 5: return 'heavy-shadow';
  }
}

/** Get the border character set for a given elevation level. */
export function getElevationBorder(level: ElevationLevel): BorderCharSet {
  return ELEVATION_BORDERS[level];
}

/** Get the ANSI style prefix for a given elevation level. */
export function getElevationAnsi(level: ElevationLevel): string {
  return ELEVATION_ANSI[level];
}
