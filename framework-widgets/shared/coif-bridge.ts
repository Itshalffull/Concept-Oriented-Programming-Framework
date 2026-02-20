// ============================================================
// COIF Bridge — Runtime connection between COIF concepts and
// framework widgets.
//
// Provides:
//  1. Signal factory — create WritableSignal instances
//  2. Machine runner — execute headless state machines
//  3. Theme resolver — compose active themes into token map
//  4. Layout engine — compute CSS from Layout config
//  5. Viewport observer — track window size / breakpoints
//  6. Element mapper — map ElementKind to framework components
// ============================================================

import type {
  WritableSignal, Signal,
  DesignTokenValue, ThemeConfig, ResolvedTheme,
  LayoutConfig, LayoutKind,
  ViewportState, Breakpoint, Orientation,
  WidgetSpec, MachineState, ConnectedProps,
  ElevationLevel, ShadowLayer,
  MotionDuration, MotionEasing, MotionTransition,
  TypeScale, TextStyle, FontStack,
  ColorScale,
} from './types.js';

// --- Signal Factory ---

let signalIdCounter = 0;

export function createSignal<T>(initialValue: T): WritableSignal<T> {
  const id = `signal-${++signalIdCounter}`;
  let value = initialValue;
  const listeners = new Set<(v: T) => void>();

  return {
    id,
    get() { return value; },
    set(v: T) {
      value = v;
      for (const fn of listeners) fn(value);
    },
    update(fn: (prev: T) => T) {
      value = fn(value);
      for (const listener of listeners) listener(value);
    },
    subscribe(listener: (v: T) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export function createComputed<T>(deps: Signal[], compute: () => T): Signal<T> {
  const id = `computed-${++signalIdCounter}`;
  let value = compute();
  const listeners = new Set<(v: T) => void>();

  for (const dep of deps) {
    dep.subscribe(() => {
      value = compute();
      for (const fn of listeners) fn(value);
    });
  }

  return {
    id,
    get() { return value; },
    subscribe(listener: (v: T) => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

// --- Machine Runner ---

export function createMachine(spec: WidgetSpec, initialContext?: Record<string, unknown>): {
  state: Signal<MachineState>;
  send: (event: { type: string; [key: string]: unknown }) => void;
  connect: () => ConnectedProps;
  destroy: () => void;
} {
  const context = { ...spec.defaultConfig, ...initialContext };
  const stateSignal = createSignal<MachineState>({
    current: spec.machineSpec.initial,
    context,
  });

  function send(event: { type: string; [key: string]: unknown }) {
    const current = stateSignal.get();
    const stateDef = spec.machineSpec.states[current.current];
    if (!stateDef?.on) return;

    const transition = stateDef.on[event.type];
    if (!transition) return;

    const target = typeof transition === 'string' ? transition : transition.target;
    stateSignal.set({
      current: target,
      context: { ...current.context, ...event },
    });
  }

  function connect(): ConnectedProps {
    const { current, context: ctx } = stateSignal.get();
    const props: ConnectedProps = {};

    for (const part of spec.anatomy.parts) {
      const partProps: Record<string, unknown> = {};

      // Map a11y attributes
      if (spec.a11ySpec && typeof spec.a11ySpec === 'object') {
        for (const [key, val] of Object.entries(spec.a11ySpec)) {
          if (key.startsWith('role') || key.startsWith('aria')) {
            partProps[key] = val;
          }
        }
      }

      // Add state flags
      partProps['data-state'] = current;
      for (const [k, v] of Object.entries(ctx)) {
        if (typeof v === 'boolean') {
          partProps[`data-${k}`] = v ? '' : undefined;
        }
      }

      props[part] = partProps;
    }

    return props;
  }

  let destroyed = false;
  function destroy() {
    destroyed = true;
  }

  return { state: stateSignal, send, connect, destroy };
}

// --- Theme Resolver ---

export function resolveTheme(
  tokens: DesignTokenValue[],
  themes: ThemeConfig[],
): ResolvedTheme {
  // Start with base token values
  const resolved: Record<string, string> = {};
  for (const token of tokens) {
    resolved[token.name] = token.value;
  }

  // Apply active themes sorted by priority
  const activeThemes = themes
    .filter(t => t.active)
    .sort((a, b) => a.priority - b.priority);

  for (const theme of activeThemes) {
    for (const [key, value] of Object.entries(theme.overrides)) {
      resolved[key] = value;
    }
  }

  const name = activeThemes.length > 0
    ? activeThemes.map(t => t.name).join('+')
    : 'default';

  return { name, tokens: resolved };
}

export function themeToCssVariables(theme: ResolvedTheme): string {
  const lines = [':root {'];
  for (const [name, value] of Object.entries(theme.tokens)) {
    const cssName = name.replace(/\./g, '-').replace(/([A-Z])/g, '-$1').toLowerCase();
    lines.push(`  --${cssName}: ${value};`);
  }
  lines.push('}');
  return lines.join('\n');
}

// --- Layout Engine ---

const LAYOUT_CSS_MAP: Record<LayoutKind, (config: LayoutConfig) => Record<string, string>> = {
  stack(config) {
    return {
      display: 'flex',
      'flex-direction': config.direction || 'column',
      gap: config.gap ? `var(--${config.gap})` : '0',
    };
  },
  grid(config) {
    const styles: Record<string, string> = { display: 'grid' };
    if (config.columns) styles['grid-template-columns'] = config.columns;
    if (config.rows) styles['grid-template-rows'] = config.rows;
    if (config.areas) styles['grid-template-areas'] = config.areas;
    if (config.gap) styles.gap = `var(--${config.gap})`;
    return styles;
  },
  split(config) {
    return {
      display: 'grid',
      'grid-template-columns': '1fr 1fr',
      gap: config.gap ? `var(--${config.gap})` : '0',
    };
  },
  overlay() {
    return {
      position: 'relative',
    };
  },
  flow(config) {
    return {
      display: 'flex',
      'flex-wrap': 'wrap',
      gap: config.gap ? `var(--${config.gap})` : '0',
    };
  },
  sidebar(config) {
    return {
      display: 'grid',
      'grid-template-columns': config.direction === 'row' ? '250px 1fr' : '1fr 250px',
      gap: config.gap ? `var(--${config.gap})` : '0',
    };
  },
  center() {
    return {
      display: 'flex',
      'justify-content': 'center',
      'align-items': 'center',
    };
  },
};

export function layoutToCSS(config: LayoutConfig): Record<string, string> {
  const generator = LAYOUT_CSS_MAP[config.kind];
  if (!generator) return {};
  return generator(config);
}

export function layoutToStyleString(config: LayoutConfig): string {
  const styles = layoutToCSS(config);
  return Object.entries(styles)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

// --- Viewport Observer ---

const DEFAULT_BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export function getBreakpoint(
  width: number,
  breakpoints: Record<string, number> = DEFAULT_BREAKPOINTS,
): Breakpoint {
  const sorted = Object.entries(breakpoints)
    .sort(([, a], [, b]) => b - a);

  for (const [name, minWidth] of sorted) {
    if (width >= minWidth) return name as Breakpoint;
  }
  return 'xs';
}

export function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

export function createViewportSignal(
  initialWidth = 1024,
  initialHeight = 768,
): WritableSignal<ViewportState> {
  return createSignal<ViewportState>({
    width: initialWidth,
    height: initialHeight,
    breakpoint: getBreakpoint(initialWidth),
    orientation: getOrientation(initialWidth, initialHeight),
  });
}

export function observeViewport(signal: WritableSignal<ViewportState>): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    signal.set({
      width,
      height,
      breakpoint: getBreakpoint(width),
      orientation: getOrientation(width, height),
    });
  };

  window.addEventListener('resize', handler);
  handler(); // initial
  return () => window.removeEventListener('resize', handler);
}

// --- Elevation ---

export function elevationToCSS(level: ElevationLevel): string {
  const shadows: Record<ElevationLevel, string> = {
    0: 'none',
    1: '0 1px 2px 0 rgba(0,0,0,0.05)',
    2: '0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)',
    3: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    4: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    5: '0 25px 50px -12px rgba(0,0,0,0.25)',
  };
  return shadows[level];
}

export function shadowLayersToCSS(layers: ShadowLayer[]): string {
  return layers
    .map(l => `${l.x ?? 0}px ${l.y}px ${l.blur}px ${l.spread ?? 0}px ${l.color}`)
    .join(', ');
}

// --- Typography ---

export function generateTypeScale(baseSize: number, ratio: number, steps: number): TypeScale {
  const names = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'] as const;
  const baseIndex = 2; // "base" is index 2
  const scale: Record<string, number> = {};

  for (let i = 0; i < Math.min(steps + baseIndex + 1, names.length); i++) {
    const exp = i - baseIndex;
    scale[names[i]] = Math.round(baseSize * Math.pow(ratio, exp) * 100) / 100;
  }

  return scale as unknown as TypeScale;
}

export function textStyleToCSS(style: TextStyle, scale: TypeScale, stacks: FontStack[]): Record<string, string> {
  const size = (scale as unknown as Record<string, number>)[style.scale];
  const stack = stacks.find(s => s.name === style.fontStack);

  const css: Record<string, string> = {};
  if (size) css['font-size'] = `${size}px`;
  if (stack) css['font-family'] = stack.fonts.join(', ');
  css['font-weight'] = String(style.weight);
  css['line-height'] = String(style.lineHeight);
  if (style.letterSpacing) css['letter-spacing'] = style.letterSpacing;
  return css;
}

// --- Palette ---

export function generateColorScale(seed: string): ColorScale {
  // Simplified scale generation (real implementation uses OKLCH)
  // Generates a 50-950 scale by adjusting lightness
  return {
    50: adjustLightness(seed, 0.95),
    100: adjustLightness(seed, 0.9),
    200: adjustLightness(seed, 0.8),
    300: adjustLightness(seed, 0.7),
    400: adjustLightness(seed, 0.6),
    500: seed,
    600: adjustLightness(seed, 0.4),
    700: adjustLightness(seed, 0.3),
    800: adjustLightness(seed, 0.2),
    900: adjustLightness(seed, 0.15),
    950: adjustLightness(seed, 0.1),
  };
}

function adjustLightness(hex: string, targetLightness: number): string {
  // Parse hex to RGB
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  // Simple lightness adjustment via linear interpolation with white/black
  const factor = targetLightness;
  const nr = Math.round(Math.min(255, (r * factor + (1 - factor) * (factor > 0.5 ? 1 : 0)) * 255));
  const ng = Math.round(Math.min(255, (g * factor + (1 - factor) * (factor > 0.5 ? 1 : 0)) * 255));
  const nb = Math.round(Math.min(255, (b * factor + (1 - factor) * (factor > 0.5 ? 1 : 0)) * 255));

  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function contrastRatio(fg: string, bg: string): number {
  const fgLum = relativeLuminance(fg);
  const bgLum = relativeLuminance(bg);
  const lighter = Math.max(fgLum, bgLum);
  const darker = Math.min(fgLum, bgLum);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;

  const srgb = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

// --- Motion ---

export function motionToCSS(transition: MotionTransition, durations: MotionDuration[], easings: MotionEasing[]): string {
  const dur = durations.find(d => d.name === transition.duration);
  const ease = easings.find(e => e.name === transition.easing);
  return `${transition.property} ${dur?.ms ?? 200}ms ${ease?.value ?? 'ease'}`;
}

export function reducedMotionCSS(): string {
  return '@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }';
}

// --- Element Mapper ---

export type ElementRenderHint = {
  tag: string;
  inputType?: string;
  role?: string;
  attributes: Record<string, string>;
};

export function mapElementToHTML(kind: string): ElementRenderHint {
  const map: Record<string, ElementRenderHint> = {
    'input-text': { tag: 'input', inputType: 'text', role: 'textbox', attributes: {} },
    'input-number': { tag: 'input', inputType: 'number', role: 'spinbutton', attributes: {} },
    'input-date': { tag: 'input', inputType: 'date', attributes: {} },
    'input-bool': { tag: 'input', inputType: 'checkbox', role: 'checkbox', attributes: {} },
    'selection-single': { tag: 'select', role: 'listbox', attributes: {} },
    'selection-multi': { tag: 'select', role: 'listbox', attributes: { multiple: 'true' } },
    'trigger': { tag: 'button', role: 'button', attributes: {} },
    'navigation': { tag: 'a', role: 'link', attributes: {} },
    'output-text': { tag: 'span', role: 'status', attributes: {} },
    'output-number': { tag: 'span', role: 'status', attributes: {} },
    'output-date': { tag: 'time', attributes: {} },
    'output-bool': { tag: 'span', role: 'status', attributes: { 'aria-live': 'polite' } },
    'group': { tag: 'fieldset', role: 'group', attributes: {} },
    'container': { tag: 'div', attributes: {} },
    'rich-text': { tag: 'div', role: 'textbox', attributes: { contenteditable: 'true' } },
    'file-upload': { tag: 'input', inputType: 'file', attributes: {} },
    'media-display': { tag: 'figure', attributes: {} },
  };
  return map[kind] || { tag: 'div', attributes: {} };
}
