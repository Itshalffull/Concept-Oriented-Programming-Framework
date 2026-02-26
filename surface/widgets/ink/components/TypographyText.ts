// ============================================================
// Clef Surface Ink Widget — TypographyText
//
// Renders text with terminal formatting that maps Clef Surface typography
// concepts to ANSI escape sequences. Font weights map to bold/dim,
// text styles map to underline/italic, and scale maps to visual
// emphasis patterns in the terminal.
// ============================================================

import type { TextStyle, FontStack } from '../../shared/types.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg } from './DesignTokenProvider.js';

// --- ANSI Format Codes ---

const ANSI = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  ITALIC: '\x1b[3m',
  UNDERLINE: '\x1b[4m',
  BLINK: '\x1b[5m',
  INVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',
  STRIKETHROUGH: '\x1b[9m',
} as const;

// --- Typography Variant Definitions ---

export type TypographyVariant =
  | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body1' | 'body2'
  | 'subtitle1' | 'subtitle2'
  | 'caption' | 'overline'
  | 'code' | 'pre'
  | 'label' | 'button';

interface VariantFormatting {
  prefix: string;
  suffix: string;
  ansi: string;
  upperCase?: boolean;
  decoration?: string;
}

const VARIANT_MAP: Record<TypographyVariant, VariantFormatting> = {
  h1: { prefix: '', suffix: '', ansi: `${ANSI.BOLD}${ANSI.UNDERLINE}`, upperCase: false, decoration: '═' },
  h2: { prefix: '', suffix: '', ansi: `${ANSI.BOLD}`, decoration: '─' },
  h3: { prefix: '', suffix: '', ansi: `${ANSI.BOLD}` },
  h4: { prefix: '', suffix: '', ansi: `${ANSI.BOLD}` },
  h5: { prefix: '', suffix: '', ansi: `${ANSI.BOLD}${ANSI.DIM}` },
  h6: { prefix: '', suffix: '', ansi: `${ANSI.DIM}${ANSI.UNDERLINE}` },
  body1: { prefix: '', suffix: '', ansi: '' },
  body2: { prefix: '', suffix: '', ansi: `${ANSI.DIM}` },
  subtitle1: { prefix: '', suffix: '', ansi: `${ANSI.ITALIC}` },
  subtitle2: { prefix: '', suffix: '', ansi: `${ANSI.DIM}${ANSI.ITALIC}` },
  caption: { prefix: '', suffix: '', ansi: `${ANSI.DIM}` },
  overline: { prefix: '', suffix: '', ansi: `${ANSI.DIM}`, upperCase: true },
  code: { prefix: '`', suffix: '`', ansi: `${ANSI.DIM}` },
  pre: { prefix: '', suffix: '', ansi: `${ANSI.DIM}` },
  label: { prefix: '', suffix: ':', ansi: `${ANSI.BOLD}` },
  button: { prefix: '[ ', suffix: ' ]', ansi: `${ANSI.BOLD}${ANSI.INVERSE}` },
};

// --- Weight to ANSI Mapping ---

function weightToAnsi(weight: number): string {
  if (weight >= 700) return ANSI.BOLD;
  if (weight <= 300) return ANSI.DIM;
  return ''; // Normal weight (400-600) gets no special formatting
}

// --- Font Category to Terminal Indicator ---

function fontCategoryIndicator(category: FontStack['category']): string {
  switch (category) {
    case 'monospace': return ''; // Terminals are already monospace
    case 'serif': return ''; // No terminal equivalent
    case 'sans-serif': return '';
    case 'display': return '';
    default: return '';
  }
}

// --- TypographyText Props ---

export interface TypographyTextProps {
  /** The text content to render. */
  text: string;
  /** Typography variant for preset formatting. */
  variant?: TypographyVariant;
  /** Clef Surface TextStyle for precise typography control. */
  textStyle?: TextStyle;
  /** Font weight override (100-900). */
  weight?: number;
  /** Foreground color as hex. */
  color?: string;
  /** Whether to apply bold formatting. */
  bold?: boolean;
  /** Whether to apply dim formatting. */
  dim?: boolean;
  /** Whether to apply italic formatting. */
  italic?: boolean;
  /** Whether to apply underline formatting. */
  underline?: boolean;
  /** Whether to apply strikethrough formatting. */
  strikethrough?: boolean;
  /** Whether to apply inverse/reverse video. */
  inverse?: boolean;
  /** Text alignment within available width. */
  align?: 'left' | 'center' | 'right';
  /** Maximum width in columns. Text wraps or truncates. */
  maxWidth?: number;
  /** Whether to truncate with ellipsis instead of wrapping. */
  truncate?: boolean;
  /** Whether to render a decoration line below headings. */
  showDecoration?: boolean;
  /** Number of blank lines after this text. */
  marginBottom?: number;
}

/**
 * Creates a TypographyText terminal node.
 *
 * Maps Clef Surface typography concepts to terminal ANSI formatting.
 * Headings get bold/underline, captions get dim, etc.
 */
export function createTypographyText(props: TypographyTextProps): TerminalNode {
  const {
    text,
    variant,
    textStyle,
    weight,
    color,
    bold,
    dim,
    italic,
    underline,
    strikethrough,
    inverse,
    align = 'left',
    maxWidth,
    truncate = false,
    showDecoration = true,
    marginBottom = 0,
  } = props;

  // Accumulate ANSI sequences
  let ansiPrefix = '';

  // Apply variant formatting if specified
  const variantDef = variant ? VARIANT_MAP[variant] : null;
  if (variantDef) {
    ansiPrefix += variantDef.ansi;
  }

  // Apply weight-based formatting
  if (weight !== undefined) {
    ansiPrefix += weightToAnsi(weight);
  } else if (textStyle) {
    ansiPrefix += weightToAnsi(textStyle.weight);
  }

  // Apply explicit formatting overrides
  if (bold) ansiPrefix += ANSI.BOLD;
  if (dim) ansiPrefix += ANSI.DIM;
  if (italic) ansiPrefix += ANSI.ITALIC;
  if (underline) ansiPrefix += ANSI.UNDERLINE;
  if (strikethrough) ansiPrefix += ANSI.STRIKETHROUGH;
  if (inverse) ansiPrefix += ANSI.INVERSE;

  // Apply color
  if (color) {
    ansiPrefix += hexToAnsiFg(color);
  }

  // Build the display text
  let displayText = text;
  if (variantDef?.upperCase) {
    displayText = displayText.toUpperCase();
  }
  if (variantDef) {
    displayText = `${variantDef.prefix}${displayText}${variantDef.suffix}`;
  }

  // Handle width constraints
  if (maxWidth && displayText.length > maxWidth) {
    if (truncate) {
      displayText = displayText.substring(0, maxWidth - 1) + '\u2026'; // ellipsis
    } else {
      displayText = wrapText(displayText, maxWidth);
    }
  }

  // Handle alignment
  if (maxWidth && align !== 'left') {
    displayText = alignText(displayText, maxWidth, align);
  }

  // Build formatted string
  const formattedText = `${ansiPrefix}${displayText}${ANSI.RESET}`;

  // Build children array
  const children: (TerminalNode | string)[] = [formattedText];

  // Add decoration line for headings
  if (showDecoration && variantDef?.decoration) {
    const decoWidth = maxWidth || stripAnsi(displayText).length;
    const decoLine = `${ANSI.DIM}${variantDef.decoration.repeat(decoWidth)}${ANSI.RESET}`;
    children.push({
      type: 'text',
      props: { role: 'decoration' },
      children: [decoLine],
    });
  }

  // Add margin bottom as spacer nodes
  for (let i = 0; i < marginBottom; i++) {
    children.push({ type: 'spacer', props: { height: 1 }, children: [] });
  }

  return {
    type: 'text',
    props: {
      role: 'typography',
      variant: variant || 'body1',
      align,
      weight: weight || textStyle?.weight || (variantDef ? undefined : 400),
    },
    children,
  };
}

// --- Text Utilities ---

/** Wrap text to fit within a given column width. */
function wrapText(text: string, width: number): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > width) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

/** Align text within a given width. */
function alignText(text: string, width: number, align: 'center' | 'right'): string {
  const lines = text.split('\n');
  return lines.map(line => {
    const stripped = stripAnsi(line);
    const padding = Math.max(0, width - stripped.length);
    if (align === 'center') {
      const left = Math.floor(padding / 2);
      return ' '.repeat(left) + line;
    } else {
      return ' '.repeat(padding) + line;
    }
  }).join('\n');
}

/** Strip ANSI escape sequences from a string for length calculation. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Measure the visible character width of a string (excluding ANSI codes). */
export function measureTextWidth(str: string): number {
  return stripAnsi(str).length;
}
