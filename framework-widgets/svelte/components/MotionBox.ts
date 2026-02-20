// ============================================================
// MotionBox — Svelte-compatible COIF component
//
// Container with CSS transitions respecting prefers-reduced-motion.
// Maps COIF MotionTransition, MotionDuration, and MotionEasing
// to live CSS transition strings. Disables or reduces animations
// when the user's OS requests reduced motion.
// ============================================================

import type {
  MotionTransition,
  MotionDuration,
  MotionEasing,
} from '../../shared/types.js';

import { motionToCSS } from '../../shared/coif-bridge.js';

// --- Component types ---

export interface MotionBoxProps {
  transitions: MotionTransition[];
  durations: MotionDuration[];
  easings: MotionEasing[];
  respectReducedMotion?: boolean;
  tag?: keyof HTMLElementTagNameMap;
  className?: string;
  'on:transitionend'?: (event: TransitionEvent) => void;
  'on:animationend'?: (event: AnimationEvent) => void;
}

export interface MotionBoxInstance {
  update(props: Partial<MotionBoxProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  readonly reducedMotion: boolean;
}

export interface MotionBoxOptions {
  target: HTMLElement;
  props: MotionBoxProps;
}

// --- Component factory ---

export function createMotionBox(
  options: MotionBoxOptions,
): MotionBoxInstance {
  const { target } = options;
  let {
    transitions,
    durations,
    easings,
    respectReducedMotion = true,
    tag = 'div',
    className,
  } = options.props;

  let onTransitionEnd = options.props['on:transitionend'];
  let onAnimationEnd = options.props['on:animationend'];

  // Create element
  let element = document.createElement(tag);
  element.setAttribute('data-coif-motion', '');
  if (className) element.className = className;
  target.appendChild(element);

  // Reactive state for reduced motion — mirrors $state
  let prefersReducedMotion = false;

  // MediaQuery listener for prefers-reduced-motion
  let mediaQuery: MediaQueryList | null = null;
  let mediaCleanup: (() => void) | null = null;

  function setupMediaQuery(): void {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mediaQuery.matches;

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
      applyTransitions();
    };

    mediaQuery.addEventListener('change', handler);
    mediaCleanup = () => {
      mediaQuery?.removeEventListener('change', handler);
    };
  }

  // Derived transition string — mirrors $derived
  function computeTransitionString(): string {
    if (respectReducedMotion && prefersReducedMotion) {
      // Reduce all transitions to near-instant
      return transitions
        .map(t => `${t.property} 0.01ms linear`)
        .join(', ');
    }

    return transitions
      .map(t => motionToCSS(t, durations, easings))
      .join(', ');
  }

  function applyTransitions(): void {
    const transitionString = computeTransitionString();
    element.style.transition = transitionString;
    element.setAttribute(
      'data-reduced-motion',
      String(respectReducedMotion && prefersReducedMotion),
    );
  }

  // Event binding — on:event directive pattern
  let eventCleanups: Array<() => void> = [];

  function bindEvents(): void {
    for (const cleanup of eventCleanups) cleanup();
    eventCleanups = [];

    if (onTransitionEnd) {
      const handler = onTransitionEnd;
      element.addEventListener('transitionend', handler);
      eventCleanups.push(() => element.removeEventListener('transitionend', handler));
    }
    if (onAnimationEnd) {
      const handler = onAnimationEnd;
      element.addEventListener('animationend', handler);
      eventCleanups.push(() => element.removeEventListener('animationend', handler));
    }
  }

  // Initialize
  setupMediaQuery();
  applyTransitions();
  bindEvents();

  return {
    get element() { return element; },
    get reducedMotion() { return prefersReducedMotion; },

    update(newProps: Partial<MotionBoxProps>): void {
      let needsTransitionUpdate = false;
      let needsEventRebind = false;

      if (newProps.transitions !== undefined) { transitions = newProps.transitions; needsTransitionUpdate = true; }
      if (newProps.durations !== undefined) { durations = newProps.durations; needsTransitionUpdate = true; }
      if (newProps.easings !== undefined) { easings = newProps.easings; needsTransitionUpdate = true; }
      if (newProps.respectReducedMotion !== undefined) { respectReducedMotion = newProps.respectReducedMotion; needsTransitionUpdate = true; }
      if (newProps.className !== undefined) {
        className = newProps.className;
        element.className = className ?? '';
      }

      if (newProps['on:transitionend'] !== undefined) { onTransitionEnd = newProps['on:transitionend']; needsEventRebind = true; }
      if (newProps['on:animationend'] !== undefined) { onAnimationEnd = newProps['on:animationend']; needsEventRebind = true; }

      // Handle tag change
      if (newProps.tag !== undefined && newProps.tag !== tag) {
        tag = newProps.tag;
        const newElement = document.createElement(tag);
        newElement.setAttribute('data-coif-motion', '');
        if (className) newElement.className = className;
        while (element.firstChild) {
          newElement.appendChild(element.firstChild);
        }
        element.replaceWith(newElement);
        element = newElement;
        needsTransitionUpdate = true;
        needsEventRebind = true;
      }

      if (needsEventRebind) bindEvents();
      if (needsTransitionUpdate) applyTransitions();
    },

    destroy(): void {
      if (mediaCleanup) mediaCleanup();
      for (const cleanup of eventCleanups) cleanup();
      element.remove();
    },
  };
}
