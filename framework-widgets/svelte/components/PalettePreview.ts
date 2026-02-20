// ============================================================
// PalettePreview — Svelte-compatible COIF component
//
// Renders a grid of color swatches from COIF palette data.
// Supports both raw ColorScale objects and semantic role
// mappings. Displays color name, hex value, and optional
// contrast info on each swatch.
// ============================================================

import type {
  ColorScale,
  SemanticRole,
} from '../../shared/types.js';

import { contrastRatio } from '../../shared/coif-bridge.js';

// --- Component types ---

export interface PaletteEntry {
  name: string;
  scale: ColorScale;
  role?: SemanticRole;
}

export interface PalettePreviewProps {
  palettes: PaletteEntry[];
  showContrast?: boolean;
  contrastBackground?: string;
  columns?: number;
  className?: string;
  'on:swatchclick'?: (event: { color: string; name: string; step: string }) => void;
}

export interface PalettePreviewInstance {
  update(props: Partial<PalettePreviewProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
}

export interface PalettePreviewOptions {
  target: HTMLElement;
  props: PalettePreviewProps;
}

// Color scale step keys in display order
const SCALE_STEPS = [
  '50', '100', '200', '300', '400', '500',
  '600', '700', '800', '900', '950',
] as const;

// --- Component factory ---

export function createPalettePreview(
  options: PalettePreviewOptions,
): PalettePreviewInstance {
  const { target } = options;
  let {
    palettes,
    showContrast = false,
    contrastBackground = '#ffffff',
    columns = SCALE_STEPS.length,
    className,
  } = options.props;
  let onSwatchClick = options.props['on:swatchclick'];

  // Root container
  const container = document.createElement('div');
  container.setAttribute('data-coif-palette-preview', '');
  if (className) container.className = className;
  target.appendChild(container);

  // Track event listener cleanups
  let cleanups: Array<() => void> = [];

  function render(): void {
    // Clean up previous listeners
    for (const cleanup of cleanups) cleanup();
    cleanups = [];
    container.innerHTML = '';

    for (const palette of palettes) {
      // Palette group header
      const header = document.createElement('div');
      header.setAttribute('data-palette-name', palette.name);
      header.style.cssText = 'font-weight: 600; margin: 0.75em 0 0.25em; font-size: 0.875em;';
      header.textContent = palette.role
        ? `${palette.name} (${palette.role})`
        : palette.name;
      container.appendChild(header);

      // Swatch grid
      const grid = document.createElement('div');
      grid.style.cssText = [
        'display: grid',
        `grid-template-columns: repeat(${columns}, 1fr)`,
        'gap: 2px',
        'margin-bottom: 0.5em',
      ].join('; ');

      for (const step of SCALE_STEPS) {
        const color = palette.scale[step as unknown as keyof ColorScale] as string;
        if (!color) continue;

        const swatch = document.createElement('div');
        swatch.setAttribute('data-color', color);
        swatch.setAttribute('data-step', step);
        swatch.setAttribute('role', 'button');
        swatch.setAttribute('tabindex', '0');
        swatch.setAttribute('aria-label', `${palette.name} ${step}: ${color}`);

        // Determine foreground color for readability
        const ratio = contrastRatio('#ffffff', color);
        const fgColor = ratio >= 4.5 ? '#ffffff' : '#000000';

        swatch.style.cssText = [
          `background-color: ${color}`,
          `color: ${fgColor}`,
          'padding: 0.5em 0.25em',
          'text-align: center',
          'font-size: 0.675em',
          'font-family: monospace',
          'border-radius: 2px',
          'cursor: pointer',
          'transition: transform 0.1s ease',
          'line-height: 1.3',
        ].join('; ');

        // Swatch label
        const label = document.createElement('div');
        label.textContent = step;
        swatch.appendChild(label);

        // Hex value
        const hex = document.createElement('div');
        hex.style.opacity = '0.85';
        hex.textContent = color;
        swatch.appendChild(hex);

        // Optional contrast ratio display
        if (showContrast) {
          const cr = contrastRatio(color, contrastBackground);
          const contrastEl = document.createElement('div');
          contrastEl.style.cssText = 'opacity: 0.7; font-size: 0.85em; margin-top: 2px;';
          contrastEl.textContent = `${cr.toFixed(1)}:1`;
          swatch.appendChild(contrastEl);
        }

        // on:swatchclick event binding
        const handleClick = () => {
          onSwatchClick?.({ color, name: palette.name, step });
        };
        const handleKeydown = (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        };

        swatch.addEventListener('click', handleClick);
        swatch.addEventListener('keydown', handleKeydown);
        cleanups.push(() => {
          swatch.removeEventListener('click', handleClick);
          swatch.removeEventListener('keydown', handleKeydown);
        });

        grid.appendChild(swatch);
      }

      container.appendChild(grid);
    }
  }

  // Initial render
  render();

  return {
    element: container,

    update(newProps: Partial<PalettePreviewProps>): void {
      if (newProps.palettes !== undefined) palettes = newProps.palettes;
      if (newProps.showContrast !== undefined) showContrast = newProps.showContrast;
      if (newProps.contrastBackground !== undefined) contrastBackground = newProps.contrastBackground;
      if (newProps.columns !== undefined) columns = newProps.columns;
      if (newProps['on:swatchclick'] !== undefined) onSwatchClick = newProps['on:swatchclick'];
      if (newProps.className !== undefined) {
        className = newProps.className;
        container.className = className ?? '';
      }
      render();
    },

    destroy(): void {
      for (const cleanup of cleanups) cleanup();
      container.remove();
    },
  };
}
