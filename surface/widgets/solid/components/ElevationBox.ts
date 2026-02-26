// ============================================================
// ElevationBox — Solid.js Component
//
// Container with reactive box-shadow driven by an elevation
// level signal. Uses Solid's fine-grained reactivity to update
// the shadow CSS property only when the level changes.
// ============================================================

import type {
  ElevationLevel,
  ShadowLayer,
} from '../../shared/types.js';

import {
  elevationToCSS,
  shadowLayersToCSS,
  createSignal as surfaceCreateSignal,
} from '../../shared/surface-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
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

export interface ElevationBoxProps {
  level: ElevationLevel;
  customShadow?: ShadowLayer[];
  tag?: string;
  class?: string;
  borderRadius?: string;
  padding?: string;
  background?: string;
  interactive?: boolean;
  hoverLevel?: ElevationLevel;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface ElevationBoxResult {
  element: HTMLElement;
  dispose: () => void;
  setLevel: (level: ElevationLevel) => void;
  currentLevel: () => ElevationLevel;
  currentShadow: () => string;
}

// --- Component ---

export function ElevationBox(props: ElevationBoxProps): ElevationBoxResult {
  const [level, setLevel] = solidCreateSignal<ElevationLevel>(props.level);
  const [isHovered, setIsHovered] = solidCreateSignal<boolean>(false);

  // createMemo: derive shadow string from level or custom layers
  const currentShadow = solidCreateMemo([level, isHovered], (): string => {
    // If hovered and interactive, use hover level
    if (props.interactive && isHovered() && props.hoverLevel !== undefined) {
      return elevationToCSS(props.hoverLevel);
    }

    // Custom shadow layers take precedence
    if (props.customShadow && props.customShadow.length > 0) {
      return shadowLayersToCSS(props.customShadow);
    }

    return elevationToCSS(level());
  });

  // Create the container element
  const tag = props.tag ?? 'div';
  const el = document.createElement(tag);
  el.setAttribute('data-surface-widget', 'elevation-box');
  el.setAttribute('data-elevation', String(props.level));

  if (props.class) {
    el.setAttribute('class', props.class);
  }

  // Base styles
  if (props.borderRadius) {
    el.style.setProperty('border-radius', props.borderRadius);
  }
  if (props.padding) {
    el.style.setProperty('padding', props.padding);
  }
  if (props.background) {
    el.style.setProperty('background', props.background);
  }

  // Smooth transition for interactive elevation changes
  if (props.interactive) {
    el.style.setProperty('transition', 'box-shadow 200ms ease');
    el.style.setProperty('cursor', 'pointer');
  }

  // Interactive hover handlers — native DOM events
  if (props.interactive) {
    el.addEventListener('mouseenter', () => {
      setIsHovered(true);
    });
    el.addEventListener('mouseleave', () => {
      setIsHovered(false);
    });
    el.addEventListener('focus', () => {
      setIsHovered(true);
    });
    el.addEventListener('blur', () => {
      setIsHovered(false);
    });
  }

  // Reactive effect: update box-shadow
  const disposeEffect = solidCreateEffect([currentShadow as () => unknown], () => {
    const shadow = currentShadow();
    el.style.setProperty('box-shadow', shadow);
    el.setAttribute('data-elevation', String(level()));
  });

  // Append children
  if (props.children) {
    for (const child of props.children) {
      el.appendChild(child);
    }
  }

  function dispose() {
    disposeEffect();
    el.remove();
  }

  return {
    element: el,
    dispose,
    setLevel,
    currentLevel: level,
    currentShadow,
  };
}
