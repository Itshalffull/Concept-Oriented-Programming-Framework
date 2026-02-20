// ============================================================
// PalettePreview — Solid.js Component
//
// Color grid with For-style iteration over color scales.
// Renders a grid of color swatches from a palette map,
// using reactive iteration to add/remove swatches when
// the palette changes.
// ============================================================

import type {
  ColorScale,
  SemanticRole,
} from '../../shared/types.js';

import {
  contrastRatio,
  createSignal as coifCreateSignal,
} from '../../shared/coif-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = coifCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateEffect(deps: Array<() => unknown>, fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  cleanup = fn();
  let lastValues = deps.map(d => d());

  const interval = setInterval(() => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      if (typeof cleanup === 'function') cleanup();
      cleanup = fn();
    }
  }, 16);

  return () => {
    clearInterval(interval);
    if (typeof cleanup === 'function') cleanup();
  };
}

// --- For-style reactive list iteration ---

function solidFor<T>(
  items: () => T[],
  renderFn: (item: T, index: number) => HTMLElement,
  container: HTMLElement,
): () => void {
  let currentElements: HTMLElement[] = [];

  const dispose = solidCreateEffect([items as () => unknown], () => {
    // Clear existing children
    for (const el of currentElements) {
      el.remove();
    }
    currentElements = [];

    // Render new items (Solid's <For> pattern)
    const list = items();
    for (let i = 0; i < list.length; i++) {
      const el = renderFn(list[i], i);
      container.appendChild(el);
      currentElements.push(el);
    }
  });

  return () => {
    dispose();
    for (const el of currentElements) {
      el.remove();
    }
  };
}

// --- Swatch step keys in order ---

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

// --- Component Props ---

export interface PalettePreviewProps {
  palettes: Record<string, ColorScale>;
  semanticMap?: Partial<Record<SemanticRole, string>>;
  swatchSize?: number;
  showLabels?: boolean;
  showContrast?: boolean;
  class?: string;
}

// --- Component Result ---

export interface PalettePreviewResult {
  element: HTMLElement;
  dispose: () => void;
  setPalettes: (palettes: Record<string, ColorScale>) => void;
}

// --- Component ---

export function PalettePreview(props: PalettePreviewProps): PalettePreviewResult {
  const [palettes, setPalettes] = solidCreateSignal<Record<string, ColorScale>>(props.palettes);
  const swatchSize = props.swatchSize ?? 48;
  const showLabels = props.showLabels ?? true;
  const showContrast = props.showContrast ?? false;

  // Root container
  const container = document.createElement('div');
  container.setAttribute('data-coif-widget', 'palette-preview');
  container.setAttribute('role', 'grid');
  container.setAttribute('aria-label', 'Color palette preview');
  if (props.class) {
    container.setAttribute('class', props.class);
  }
  container.style.setProperty('display', 'flex');
  container.style.setProperty('flex-direction', 'column');
  container.style.setProperty('gap', '16px');

  // Derive flat list of palette entries for For-style iteration
  const paletteEntries = (): Array<{ name: string; scale: ColorScale }> => {
    const p = palettes();
    return Object.entries(p).map(([name, scale]) => ({ name, scale }));
  };

  // Render each palette row using For-style iteration
  const disposeFor = solidFor(
    paletteEntries,
    (entry) => {
      const row = document.createElement('div');
      row.setAttribute('role', 'row');
      row.setAttribute('data-palette', entry.name);
      row.style.setProperty('display', 'flex');
      row.style.setProperty('flex-direction', 'column');
      row.style.setProperty('gap', '4px');

      // Palette name header
      if (showLabels) {
        const header = document.createElement('div');
        header.setAttribute('role', 'rowheader');
        header.textContent = entry.name;
        header.style.setProperty('font-weight', '600');
        header.style.setProperty('font-size', '14px');
        header.style.setProperty('text-transform', 'capitalize');

        // Show semantic role mapping if present
        if (props.semanticMap) {
          const role = Object.entries(props.semanticMap).find(
            ([, paletteName]) => paletteName === entry.name
          );
          if (role) {
            const badge = document.createElement('span');
            badge.textContent = ` (${role[0]})`;
            badge.style.setProperty('font-weight', '400');
            badge.style.setProperty('color', '#666');
            badge.style.setProperty('font-size', '12px');
            header.appendChild(badge);
          }
        }

        row.appendChild(header);
      }

      // Swatch grid
      const swatchRow = document.createElement('div');
      swatchRow.setAttribute('role', 'row');
      swatchRow.style.setProperty('display', 'flex');
      swatchRow.style.setProperty('gap', '2px');
      swatchRow.style.setProperty('flex-wrap', 'wrap');

      const scaleRecord = entry.scale as unknown as Record<string, string>;

      for (const step of SCALE_STEPS) {
        const color = scaleRecord[String(step)];
        if (!color) continue;

        const swatch = document.createElement('div');
        swatch.setAttribute('role', 'gridcell');
        swatch.setAttribute('data-step', String(step));
        swatch.setAttribute('title', `${entry.name}-${step}: ${color}`);
        swatch.style.setProperty('width', `${swatchSize}px`);
        swatch.style.setProperty('height', `${swatchSize}px`);
        swatch.style.setProperty('background-color', color);
        swatch.style.setProperty('border-radius', '4px');
        swatch.style.setProperty('display', 'flex');
        swatch.style.setProperty('align-items', 'center');
        swatch.style.setProperty('justify-content', 'center');
        swatch.style.setProperty('position', 'relative');
        swatch.style.setProperty('cursor', 'pointer');

        if (showLabels) {
          const stepLabel = document.createElement('span');
          stepLabel.textContent = String(step);
          // Determine text color based on contrast
          const textOnLight = contrastRatio('#000000', color);
          const textOnDark = contrastRatio('#ffffff', color);
          stepLabel.style.setProperty('color', textOnLight > textOnDark ? '#000' : '#fff');
          stepLabel.style.setProperty('font-size', '10px');
          stepLabel.style.setProperty('font-weight', '500');
          swatch.appendChild(stepLabel);
        }

        if (showContrast) {
          const contrastLabel = document.createElement('span');
          const ratio = contrastRatio('#ffffff', color);
          contrastLabel.textContent = `${ratio.toFixed(1)}`;
          contrastLabel.style.setProperty('position', 'absolute');
          contrastLabel.style.setProperty('bottom', '2px');
          contrastLabel.style.setProperty('right', '2px');
          contrastLabel.style.setProperty('font-size', '8px');
          contrastLabel.style.setProperty('color', ratio >= 4.5 ? '#0f0' : '#f00');
          swatch.appendChild(contrastLabel);
        }

        // on:click — copy color to clipboard
        swatch.addEventListener('click', () => {
          if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(color).catch(() => { /* noop */ });
          }
          swatch.dispatchEvent(
            new CustomEvent('coif:swatch-click', {
              bubbles: true,
              detail: { palette: entry.name, step, color },
            })
          );
        });

        swatchRow.appendChild(swatch);
      }

      row.appendChild(swatchRow);
      return row;
    },
    container,
  );

  function dispose() {
    disposeFor();
    container.remove();
  }

  return { element: container, dispose, setPalettes };
}
