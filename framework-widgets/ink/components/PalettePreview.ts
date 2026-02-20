// ============================================================
// COIF Ink Widget — PalettePreview
//
// Renders color swatches as colored block characters in the
// terminal. Shows color name, hex value, and a visual swatch
// using the full-block Unicode character (█) with ANSI
// truecolor backgrounds.
// ============================================================

import type { ColorScale, SemanticRole } from '../../shared/types.js';
import { generateColorScale, contrastRatio } from '../../shared/coif-bridge.js';
import type { TerminalNode } from './DesignTokenProvider.js';
import { hexToAnsiFg, hexToAnsiBg, parseHex } from './DesignTokenProvider.js';

// --- ANSI Constants ---

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
const ANSI_DIM = '\x1b[2m';

const BLOCK_CHAR = '\u2588'; // Full block: █
const HALF_BLOCK = '\u2584'; // Lower half block: ▄
const SHADE_LIGHT = '\u2591'; // Light shade: ░
const SHADE_MEDIUM = '\u2592'; // Medium shade: ▒
const SHADE_DARK = '\u2593'; // Dark shade: ▓

// --- Scale Step Labels ---

const SCALE_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

// --- PalettePreview Props ---

export interface PalettePreviewProps {
  /** Named colors to display. Each key is a color name, value is a hex color. */
  colors?: Record<string, string>;
  /** Color scales to display (generated from seed colors). */
  scales?: Record<string, ColorScale>;
  /** Semantic role mappings to display. */
  semanticColors?: Partial<Record<SemanticRole, string>>;
  /** Width of each color swatch in block characters. */
  swatchWidth?: number;
  /** Whether to show hex values alongside swatches. */
  showHex?: boolean;
  /** Whether to show contrast ratio against white and black. */
  showContrast?: boolean;
  /** Layout: 'horizontal' shows swatches in a row, 'vertical' in a column. */
  layout?: 'horizontal' | 'vertical';
  /** Title for the palette preview. */
  title?: string;
  /** Maximum width in columns. */
  maxWidth?: number;
}

/**
 * Creates a PalettePreview terminal node.
 *
 * Renders color swatches using Unicode block characters
 * with ANSI truecolor escape sequences.
 */
export function createPalettePreview(props: PalettePreviewProps): TerminalNode {
  const {
    colors = {},
    scales = {},
    semanticColors = {},
    swatchWidth = 4,
    showHex = true,
    showContrast = false,
    layout = 'vertical',
    title = 'Palette',
    maxWidth,
  } = props;

  const children: (TerminalNode | string)[] = [];

  // Title
  children.push({
    type: 'text',
    props: { role: 'title' },
    children: [`${ANSI_BOLD}${title}${ANSI_RESET}`],
  });

  children.push({
    type: 'text',
    props: {},
    children: [`${ANSI_DIM}${'─'.repeat(maxWidth || 40)}${ANSI_RESET}`],
  });

  // Render named colors
  if (Object.keys(colors).length > 0) {
    children.push({
      type: 'text',
      props: { role: 'section-header' },
      children: [`\n${ANSI_BOLD}Named Colors${ANSI_RESET}`],
    });

    for (const [name, hex] of Object.entries(colors)) {
      children.push(renderColorSwatch(name, hex, swatchWidth, showHex, showContrast));
    }
  }

  // Render semantic colors
  if (Object.keys(semanticColors).length > 0) {
    children.push({
      type: 'text',
      props: { role: 'section-header' },
      children: [`\n${ANSI_BOLD}Semantic Colors${ANSI_RESET}`],
    });

    for (const [role, hex] of Object.entries(semanticColors)) {
      if (hex) {
        children.push(renderColorSwatch(role, hex, swatchWidth, showHex, showContrast));
      }
    }
  }

  // Render color scales
  if (Object.keys(scales).length > 0) {
    children.push({
      type: 'text',
      props: { role: 'section-header' },
      children: [`\n${ANSI_BOLD}Color Scales${ANSI_RESET}`],
    });

    for (const [scaleName, scale] of Object.entries(scales)) {
      children.push(renderColorScale(scaleName, scale, swatchWidth, layout, showHex));
    }
  }

  return {
    type: 'box',
    props: {
      role: 'palette-preview',
      flexDirection: 'column',
      padding: 1,
    },
    children,
  };
}

// --- Swatch Rendering ---

function renderColorSwatch(
  name: string,
  hex: string,
  swatchWidth: number,
  showHex: boolean,
  showContrast: boolean,
): TerminalNode {
  const bgAnsi = hexToAnsiBg(hex);
  const swatch = `${bgAnsi}${' '.repeat(swatchWidth)}${ANSI_RESET}`;

  let label = ` ${name}`;
  if (showHex) {
    label += `  ${ANSI_DIM}${hex}${ANSI_RESET}`;
  }
  if (showContrast) {
    const whiteContrast = contrastRatio(hex, '#ffffff');
    const blackContrast = contrastRatio(hex, '#000000');
    label += `  ${ANSI_DIM}W:${whiteContrast.toFixed(1)} B:${blackContrast.toFixed(1)}${ANSI_RESET}`;
  }

  return {
    type: 'text',
    props: { role: 'swatch', colorName: name, hex },
    children: [`${swatch}${label}`],
  };
}

function renderColorScale(
  name: string,
  scale: ColorScale,
  swatchWidth: number,
  layout: 'horizontal' | 'vertical',
  showHex: boolean,
): TerminalNode {
  const children: (TerminalNode | string)[] = [];

  // Scale name header
  children.push({
    type: 'text',
    props: { role: 'scale-name' },
    children: [`  ${ANSI_BOLD}${name}${ANSI_RESET}`],
  });

  const scaleEntries: [string, string][] = SCALE_STEPS.map(step => {
    const value = scale[step as unknown as keyof ColorScale];
    return [step, value];
  });

  if (layout === 'horizontal') {
    // Render all swatches on one line
    let swatchLine = '  ';
    let labelLine = '  ';

    for (const [step, hex] of scaleEntries) {
      const bgAnsi = hexToAnsiBg(hex);
      swatchLine += `${bgAnsi}${' '.repeat(swatchWidth)}${ANSI_RESET}`;
      labelLine += step.padEnd(swatchWidth);
    }

    children.push(
      { type: 'text', props: {}, children: [swatchLine] },
      { type: 'text', props: {}, children: [`${ANSI_DIM}${labelLine}${ANSI_RESET}`] },
    );

    if (showHex) {
      let hexLine = '  ';
      for (const [, hex] of scaleEntries) {
        hexLine += `${ANSI_DIM}${hex.padEnd(swatchWidth + 3)}${ANSI_RESET}`;
      }
      // Only show hex line if it would fit
      children.push({ type: 'text', props: {}, children: [hexLine] });
    }
  } else {
    // Render each swatch on its own line
    for (const [step, hex] of scaleEntries) {
      const bgAnsi = hexToAnsiBg(hex);
      const swatch = `${bgAnsi}${' '.repeat(swatchWidth)}${ANSI_RESET}`;

      // Choose foreground color for readability
      const { r, g, b } = parseHex(hex);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const fgAnsi = luminance > 0.5 ? hexToAnsiFg('#000000') : hexToAnsiFg('#ffffff');
      const blockSwatch = `${hexToAnsiFg(hex)}${BLOCK_CHAR.repeat(swatchWidth)}${ANSI_RESET}`;

      let label = `  ${step.padEnd(4)}`;
      if (showHex) {
        label += `  ${ANSI_DIM}${hex}${ANSI_RESET}`;
      }

      children.push({
        type: 'text',
        props: { step, hex },
        children: [`  ${blockSwatch}${label}`],
      });
    }
  }

  return {
    type: 'box',
    props: {
      role: 'color-scale',
      scaleName: name,
      flexDirection: 'column',
    },
    children,
  };
}

// --- Interactive PalettePreview ---

export class PalettePreviewInteractive {
  private node: TerminalNode;
  private selectedColorIndex = 0;
  private colorEntries: Array<{ name: string; hex: string }> = [];
  private listeners: Set<(node: TerminalNode) => void> = new Set();
  private destroyed = false;

  constructor(private props: PalettePreviewProps) {
    this.buildColorEntries();
    this.node = this.buildNode();
  }

  /** Handle keyboard navigation through color swatches. */
  handleKey(key: string): boolean {
    if (this.destroyed) return false;

    switch (key) {
      case 'up':
      case 'k':
        this.selectedColorIndex = Math.max(0, this.selectedColorIndex - 1);
        this.notify();
        return true;
      case 'down':
      case 'j':
        this.selectedColorIndex = Math.min(
          this.colorEntries.length - 1,
          this.selectedColorIndex + 1,
        );
        this.notify();
        return true;
      default:
        return false;
    }
  }

  /** Get info about the currently selected color. */
  getSelectedColor(): { name: string; hex: string } | null {
    return this.colorEntries[this.selectedColorIndex] || null;
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
    this.destroyed = true;
    this.listeners.clear();
  }

  private buildColorEntries(): void {
    this.colorEntries = [];
    if (this.props.colors) {
      for (const [name, hex] of Object.entries(this.props.colors)) {
        this.colorEntries.push({ name, hex });
      }
    }
    if (this.props.semanticColors) {
      for (const [role, hex] of Object.entries(this.props.semanticColors)) {
        if (hex) this.colorEntries.push({ name: role, hex });
      }
    }
  }

  private buildNode(): TerminalNode {
    return createPalettePreview(this.props);
  }

  private notify(): void {
    this.node = this.buildNode();
    for (const listener of this.listeners) {
      listener(this.node);
    }
  }
}
