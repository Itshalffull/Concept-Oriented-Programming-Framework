// ============================================================
// COIF Ink Widget — DesignTokenProvider
//
// Wraps children and provides design token values as ANSI color
// escape sequences. Maps CSS hex colors to truecolor (24-bit)
// ANSI escape codes for terminal rendering.
// ============================================================

import type {
  DesignTokenValue,
  ResolvedTheme,
  TokenType,
} from '../../shared/types.js';

import { resolveTheme } from '../../shared/coif-bridge.js';

// --- TerminalNode (shared across all Ink widgets) ---

export interface TerminalNode {
  type: 'box' | 'text' | 'input' | 'spacer';
  props: Record<string, unknown>;
  children: (TerminalNode | string)[];
}

// --- ANSI Color Helpers ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';

/** Convert a CSS hex color (#rrggbb or #rgb) to truecolor foreground escape sequence. */
export function hexToAnsiFg(hex: string): string {
  const { r, g, b } = parseHex(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** Convert a CSS hex color to truecolor background escape sequence. */
export function hexToAnsiBg(hex: string): string {
  const { r, g, b } = parseHex(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

/** Parse a hex color string into RGB components. */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/** Map a CSS named color to its hex equivalent. */
const NAMED_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000',
  green: '#00ff00', blue: '#0000ff', yellow: '#ffff00',
  cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080',
  grey: '#808080', orange: '#ffa500', purple: '#800080',
  transparent: '#000000',
};

export function resolveColor(value: string): string {
  if (value.startsWith('#')) return value;
  if (value.startsWith('rgb')) {
    const match = value.match(/(\d+)/g);
    if (match && match.length >= 3) {
      const r = parseInt(match[0], 10);
      const g = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
  }
  return NAMED_COLORS[value.toLowerCase()] || '#ffffff';
}

// --- Token-to-ANSI Mapping ---

export interface AnsiTokenMap {
  /** Map from token name to ANSI escape sequence string. */
  colors: Record<string, string>;
  /** Map from token name to resolved hex color. */
  hexColors: Record<string, string>;
  /** Map from token name to raw resolved value. */
  raw: Record<string, string>;
}

/** Build an ANSI token map from resolved theme tokens. */
export function buildAnsiTokenMap(theme: ResolvedTheme): AnsiTokenMap {
  const colors: Record<string, string> = {};
  const hexColors: Record<string, string> = {};
  const raw: Record<string, string> = {};

  for (const [name, value] of Object.entries(theme.tokens)) {
    raw[name] = value;

    // Detect color-like values and convert to ANSI
    if (isColorValue(value)) {
      const hex = resolveColor(value);
      hexColors[name] = hex;
      colors[name] = hexToAnsiFg(hex);
    }
  }

  return { colors, hexColors, raw };
}

function isColorValue(value: string): boolean {
  if (value.startsWith('#')) return true;
  if (value.startsWith('rgb')) return true;
  if (NAMED_COLORS[value.toLowerCase()]) return true;
  return false;
}

// --- DesignTokenProvider Component ---

export interface DesignTokenProviderProps {
  /** Raw design tokens to provide. */
  tokens: DesignTokenValue[];
  /** Theme configurations to resolve against tokens. */
  themes?: import('../../shared/types.js').ThemeConfig[];
  /** Pre-resolved theme (alternative to tokens + themes). */
  resolvedTheme?: ResolvedTheme;
  /** Child nodes to wrap. */
  children: (TerminalNode | string)[];
  /** Whether to render a visual border around the provider scope. */
  showBorder?: boolean;
  /** Label to display in the border header. */
  label?: string;
}

/**
 * Creates a DesignTokenProvider terminal node.
 *
 * This wraps children and annotates the tree with resolved token
 * information. The ANSI token map is attached to the node props
 * so that descendant renderers can access color values.
 */
export function createDesignTokenProvider(props: DesignTokenProviderProps): TerminalNode {
  const {
    tokens,
    themes = [],
    resolvedTheme,
    children,
    showBorder = false,
    label = 'tokens',
  } = props;

  // Resolve theme from tokens or use pre-resolved
  const theme = resolvedTheme ?? resolveTheme(tokens, themes);
  const ansiMap = buildAnsiTokenMap(theme);

  const wrappedChildren: (TerminalNode | string)[] = [];

  if (showBorder) {
    const headerText = ` ${ANSI_DIM}[${label}: ${theme.name}]${ANSI_RESET} `;
    wrappedChildren.push({
      type: 'text',
      props: { style: 'dim' },
      children: [headerText],
    });
  }

  wrappedChildren.push(...children);

  return {
    type: 'box',
    props: {
      role: 'token-provider',
      themeName: theme.name,
      ansiTokenMap: ansiMap,
      borderStyle: showBorder ? 'single' : 'none',
      flexDirection: 'column',
    },
    children: wrappedChildren,
  };
}

// --- Interactive Provider (runtime token updates) ---

export class DesignTokenProviderInteractive {
  private node: TerminalNode;
  private ansiMap: AnsiTokenMap;
  private theme: ResolvedTheme;
  private listeners: Set<(node: TerminalNode) => void> = new Set();

  constructor(private props: DesignTokenProviderProps) {
    this.theme = props.resolvedTheme ?? resolveTheme(props.tokens, props.themes ?? []);
    this.ansiMap = buildAnsiTokenMap(this.theme);
    this.node = this.buildNode();
  }

  /** Get the current ANSI token map for downstream components. */
  getTokenMap(): AnsiTokenMap {
    return this.ansiMap;
  }

  /** Get the resolved theme. */
  getTheme(): ResolvedTheme {
    return this.theme;
  }

  /** Resolve a single token name to its ANSI foreground color. */
  resolveTokenColor(name: string): string {
    return this.ansiMap.colors[name] || '';
  }

  /** Resolve a single token name to its hex color. */
  resolveTokenHex(name: string): string {
    return this.ansiMap.hexColors[name] || '';
  }

  /** Resolve a raw token value by name. */
  resolveTokenRaw(name: string): string {
    return this.ansiMap.raw[name] || '';
  }

  /** Update the theme at runtime (e.g., theme switch). */
  updateTheme(newTheme: ResolvedTheme): void {
    this.theme = newTheme;
    this.ansiMap = buildAnsiTokenMap(newTheme);
    this.node = this.buildNode();
    this.notify();
  }

  /** Subscribe to re-renders. */
  onRender(listener: (node: TerminalNode) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  render(): TerminalNode {
    return this.node;
  }

  destroy(): void {
    this.listeners.clear();
  }

  private buildNode(): TerminalNode {
    return createDesignTokenProvider({
      ...this.props,
      resolvedTheme: this.theme,
    });
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.node);
    }
  }
}
