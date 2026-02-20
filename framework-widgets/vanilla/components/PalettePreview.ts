// ============================================================
// PalettePreview — Vanilla DOM Component
//
// Creates a grid of color swatch <div> elements with
// background-color set from a ColorScale (50-950).
// Supports multiple named palette scales with accessible
// contrast labels.
// ============================================================

import type {
  ColorScale,
  SemanticRole,
} from '../../shared/types.js';

import { contrastRatio } from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface PalettePreviewProps {
  /** Map of palette name to its color scale */
  palettes: Record<string, ColorScale>;
  /** Optional semantic role labels for each palette */
  roles?: Record<string, SemanticRole>;
  /** Number of columns in the swatch grid (default: 11 for all steps) */
  columns?: number;
  /** Size of each swatch in pixels */
  swatchSize?: number;
  /** Whether to show the hex label on each swatch */
  showLabels?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export interface PalettePreviewOptions {
  target: HTMLElement;
  props: PalettePreviewProps;
}

// Scale step keys in order
const SCALE_STEPS = [
  '50', '100', '200', '300', '400', '500',
  '600', '700', '800', '900', '950',
] as const;

// --- Component ---

export class PalettePreview {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: PalettePreviewProps;

  constructor(options: PalettePreviewOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-palette-preview', '');
    this.el.setAttribute('role', 'presentation');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<PalettePreviewProps>): void {
    if (props.palettes !== undefined) this.props.palettes = props.palettes;
    if (props.roles !== undefined) this.props.roles = props.roles;
    if (props.columns !== undefined) this.props.columns = props.columns;
    if (props.swatchSize !== undefined) this.props.swatchSize = props.swatchSize;
    if (props.showLabels !== undefined) this.props.showLabels = props.showLabels;
    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    this.render();
  }

  destroy(): void {
    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private render(): void {
    const { palettes, roles, columns, swatchSize, showLabels } = this.props;

    // Clear previous content
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    const size = swatchSize ?? 48;
    const cols = columns ?? SCALE_STEPS.length;

    for (const [paletteName, scale] of Object.entries(palettes)) {
      const section = document.createElement('div');
      section.setAttribute('data-palette', paletteName);
      section.style.marginBottom = '16px';

      // Palette header
      const header = document.createElement('div');
      header.style.fontWeight = '600';
      header.style.marginBottom = '4px';
      header.style.fontSize = '14px';
      const role = roles?.[paletteName];
      header.textContent = role
        ? `${paletteName} (${role})`
        : paletteName;
      section.appendChild(header);

      // Swatch grid
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = `repeat(${cols}, ${size}px)`;
      grid.style.gap = '2px';

      for (const step of SCALE_STEPS) {
        const color = scale[step as unknown as keyof ColorScale] as string;
        const swatch = document.createElement('div');
        swatch.style.width = `${size}px`;
        swatch.style.height = `${size}px`;
        swatch.style.backgroundColor = color;
        swatch.style.borderRadius = '4px';
        swatch.style.display = 'flex';
        swatch.style.alignItems = 'center';
        swatch.style.justifyContent = 'center';
        swatch.style.position = 'relative';
        swatch.setAttribute('title', `${paletteName}-${step}: ${color}`);
        swatch.setAttribute('aria-label', `${paletteName} ${step}: ${color}`);

        if (showLabels !== false) {
          const label = document.createElement('span');
          label.style.fontSize = '9px';
          label.style.fontFamily = 'monospace';
          label.style.textAlign = 'center';
          label.style.lineHeight = '1.2';
          label.style.pointerEvents = 'none';

          // Choose light or dark text for contrast
          const ratio = contrastRatio('#ffffff', color);
          label.style.color = ratio >= 4.5 ? '#ffffff' : '#000000';

          label.textContent = step;
          swatch.appendChild(label);
        }

        grid.appendChild(swatch);
      }

      section.appendChild(grid);
      this.el.appendChild(section);
    }
  }
}
