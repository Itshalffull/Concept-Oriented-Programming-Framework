// ============================================================
// LayoutContainer — Solid.js Component
//
// Reactive flex/grid layout from LayoutConfig. Computes CSS
// layout properties from the COIF layout configuration and
// applies responsive overrides based on viewport breakpoint.
// ============================================================

import type {
  LayoutConfig,
  Breakpoint,
} from '../../shared/types.js';

import {
  layoutToCSS,
  createSignal as coifCreateSignal,
} from '../../shared/coif-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = coifCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateMemo<T>(deps: Array<() => unknown>, compute: () => T): () => T {
  let cached = compute();
  let lastValues = deps.map(d => d());

  return () => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      cached = compute();
    }
    return cached;
  };
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

// --- Component Props ---

export interface LayoutContainerProps {
  layout: LayoutConfig;
  breakpoint?: Breakpoint;
  tag?: string;
  class?: string;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface LayoutContainerResult {
  element: HTMLElement;
  dispose: () => void;
  setLayout: (layout: LayoutConfig) => void;
  setBreakpoint: (bp: Breakpoint) => void;
  computedCSS: () => Record<string, string>;
}

// --- Component ---

export function LayoutContainer(props: LayoutContainerProps): LayoutContainerResult {
  const [layout, setLayout] = solidCreateSignal<LayoutConfig>(props.layout);
  const [breakpoint, setBreakpoint] = solidCreateSignal<Breakpoint>(props.breakpoint ?? 'md');

  // createMemo: derive effective layout config by merging responsive overrides
  const effectiveConfig = solidCreateMemo([layout, breakpoint], (): LayoutConfig => {
    const base = layout();
    const bp = breakpoint();

    if (!base.responsive || !base.responsive[bp]) {
      return base;
    }

    // Merge responsive overrides into base config
    return { ...base, ...base.responsive[bp] } as LayoutConfig;
  });

  // createMemo: derive CSS properties from effective config
  const computedCSS = solidCreateMemo(
    [effectiveConfig as () => unknown],
    (): Record<string, string> => {
      return layoutToCSS(effectiveConfig());
    }
  );

  // Create the container element
  const tag = props.tag ?? 'div';
  const el = document.createElement(tag);
  el.setAttribute('data-coif-widget', 'layout-container');
  el.setAttribute('data-layout-kind', props.layout.kind);

  if (props.class) {
    el.setAttribute('class', props.class);
  }

  if (props.layout.name) {
    el.setAttribute('data-layout-name', props.layout.name);
  }

  // Reactive effect: apply computed CSS styles to the element
  const disposeStyles = solidCreateEffect([computedCSS as () => unknown, breakpoint], () => {
    const styles = computedCSS();

    // Clear previous layout styles before applying new ones
    el.style.cssText = '';

    for (const [prop, value] of Object.entries(styles)) {
      el.style.setProperty(prop, value);
    }

    // Update data attributes
    el.setAttribute('data-breakpoint', breakpoint());
    el.setAttribute('data-layout-kind', effectiveConfig().kind);
  });

  // Recursively render child LayoutConfig items if provided
  const childDisposers: Array<() => void> = [];

  if (props.layout.children && props.layout.children.length > 0) {
    for (const childConfig of props.layout.children) {
      const childResult = LayoutContainer({
        layout: childConfig,
        breakpoint: props.breakpoint,
      });
      el.appendChild(childResult.element);
      childDisposers.push(childResult.dispose);
    }
  }

  // Append external children
  if (props.children) {
    for (const child of props.children) {
      el.appendChild(child);
    }
  }

  function dispose() {
    disposeStyles();
    for (const d of childDisposers) d();
    el.remove();
  }

  return {
    element: el,
    dispose,
    setLayout,
    setBreakpoint,
    computedCSS,
  };
}
