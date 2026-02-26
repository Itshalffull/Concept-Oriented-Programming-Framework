// ============================================================
// TypographyText — Solid.js Component
//
// Text element with computed styles from typography scale.
// Uses createMemo for derived style values so recomputation
// only happens when the input scale/style props actually change.
// ============================================================

import type {
  TextStyle,
  TypeScale,
  FontStack,
} from '../../shared/types.js';

import {
  textStyleToCSS,
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

export type TypographyTag = 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label' | 'small' | 'strong' | 'em';

export interface TypographyTextProps {
  textStyle: TextStyle;
  scale: TypeScale;
  fontStacks: FontStack[];
  tag?: TypographyTag;
  content?: string;
  class?: string;
  color?: string;
  truncate?: boolean;
  maxLines?: number;
}

// --- Component Result ---

export interface TypographyTextResult {
  element: HTMLElement;
  dispose: () => void;
  setContent: (text: string) => void;
  setTextStyle: (style: TextStyle) => void;
  computedStyles: () => Record<string, string>;
}

// --- Component ---

export function TypographyText(props: TypographyTextProps): TypographyTextResult {
  const [textStyle, setTextStyle] = solidCreateSignal<TextStyle>(props.textStyle);
  const [content, setContent] = solidCreateSignal<string>(props.content ?? '');

  // createMemo: derive CSS styles only when textStyle changes
  const computedStyles = solidCreateMemo([textStyle], () => {
    const styles = textStyleToCSS(textStyle(), props.scale, props.fontStacks);

    // Apply optional color override
    if (props.color) {
      styles['color'] = props.color;
    }

    // Apply truncation styles
    if (props.truncate) {
      styles['overflow'] = 'hidden';
      styles['text-overflow'] = 'ellipsis';
      styles['white-space'] = 'nowrap';
    }

    // Apply line clamping
    if (props.maxLines && props.maxLines > 1) {
      styles['display'] = '-webkit-box';
      styles['-webkit-line-clamp'] = String(props.maxLines);
      styles['-webkit-box-orient'] = 'vertical';
      styles['overflow'] = 'hidden';
    }

    return styles;
  });

  // Create the DOM element with the specified tag
  const tag = props.tag ?? 'span';
  const el = document.createElement(tag);
  el.setAttribute('data-surface-widget', 'typography-text');
  el.setAttribute('data-style-name', props.textStyle.name);

  if (props.class) {
    el.setAttribute('class', props.class);
  }

  // Reactive effect: apply computed styles to the element
  const disposeStyles = solidCreateEffect([computedStyles as () => unknown], () => {
    const styles = computedStyles();
    for (const [prop, value] of Object.entries(styles)) {
      el.style.setProperty(prop, value);
    }
  });

  // Reactive effect: update text content
  const disposeContent = solidCreateEffect([content], () => {
    el.textContent = content();
  });

  function dispose() {
    disposeStyles();
    disposeContent();
    el.remove();
  }

  return {
    element: el,
    dispose,
    setContent,
    setTextStyle,
    computedStyles,
  };
}
