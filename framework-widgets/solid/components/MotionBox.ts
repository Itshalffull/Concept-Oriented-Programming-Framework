// ============================================================
// MotionBox — Solid.js Component
//
// Animated container with CSS transitions driven by COIF
// motion tokens. Supports reduced-motion preferences via
// matchMedia and reactive transition property updates.
// ============================================================

import type {
  MotionDuration,
  MotionEasing,
  MotionTransition,
} from '../../shared/types.js';

import {
  motionToCSS,
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

export interface MotionBoxProps {
  transitions: MotionTransition[];
  durations: MotionDuration[];
  easings: MotionEasing[];
  tag?: string;
  class?: string;
  respectReducedMotion?: boolean;
  animateOnMount?: boolean;
  mountStyles?: Record<string, string>;
  activeStyles?: Record<string, string>;
  children?: HTMLElement[];
}

// --- Component Result ---

export interface MotionBoxResult {
  element: HTMLElement;
  dispose: () => void;
  trigger: (styles: Record<string, string>) => void;
  reset: () => void;
  prefersReducedMotion: () => boolean;
  transitionCSS: () => string;
}

// --- Component ---

export function MotionBox(props: MotionBoxProps): MotionBoxResult {
  const respectReduced = props.respectReducedMotion ?? true;

  // Detect reduced motion preference reactively
  const [reducedMotion, setReducedMotion] = solidCreateSignal<boolean>(false);

  let mediaQuery: MediaQueryList | null = null;
  if (typeof window !== 'undefined' && respectReduced) {
    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
  }

  // Track active styles for triggering animations
  const [activeStyleMap, setActiveStyleMap] = solidCreateSignal<Record<string, string>>(
    props.mountStyles ?? {}
  );

  // createMemo: derive the full transition CSS string
  const transitionCSS = solidCreateMemo(
    [reducedMotion],
    (): string => {
      if (reducedMotion()) {
        return 'none';
      }
      return props.transitions
        .map(t => motionToCSS(t, props.durations, props.easings))
        .join(', ');
    }
  );

  // Create the container element
  const tag = props.tag ?? 'div';
  const el = document.createElement(tag);
  el.setAttribute('data-coif-widget', 'motion-box');

  if (props.class) {
    el.setAttribute('class', props.class);
  }

  // Reactive effect: apply transition CSS
  const disposeTransition = solidCreateEffect([transitionCSS as () => unknown], () => {
    const css = transitionCSS();
    el.style.setProperty('transition', css);

    if (reducedMotion()) {
      el.setAttribute('data-reduced-motion', 'true');
    } else {
      el.removeAttribute('data-reduced-motion');
    }
  });

  // Reactive effect: apply active styles
  const disposeStyles = solidCreateEffect([activeStyleMap as () => unknown], () => {
    const styles = activeStyleMap();
    for (const [prop, value] of Object.entries(styles)) {
      el.style.setProperty(prop, value);
    }
  });

  // Listen for transitionend events
  el.addEventListener('transitionend', (e: TransitionEvent) => {
    el.dispatchEvent(
      new CustomEvent('coif:transition-end', {
        bubbles: true,
        detail: {
          property: e.propertyName,
          elapsedTime: e.elapsedTime,
        },
      })
    );
  });

  // Animate on mount if requested
  if (props.animateOnMount && props.activeStyles) {
    // Apply mount styles first, then defer active styles for transition
    if (props.mountStyles) {
      for (const [prop, value] of Object.entries(props.mountStyles)) {
        el.style.setProperty(prop, value);
      }
    }

    // Use requestAnimationFrame to trigger the transition after initial paint
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setActiveStyleMap(props.activeStyles!);
        });
      });
    }
  }

  // Append children
  if (props.children) {
    for (const child of props.children) {
      el.appendChild(child);
    }
  }

  /** Trigger a transition to the given styles */
  function trigger(styles: Record<string, string>) {
    setActiveStyleMap(styles);
  }

  /** Reset to mount styles or clear */
  function reset() {
    setActiveStyleMap(props.mountStyles ?? {});
  }

  function dispose() {
    disposeTransition();
    disposeStyles();
    if (mediaQuery) {
      mediaQuery.removeEventListener('change', () => {});
    }
    el.remove();
  }

  return {
    element: el,
    dispose,
    trigger,
    reset,
    prefersReducedMotion: reducedMotion,
    transitionCSS,
  };
}
