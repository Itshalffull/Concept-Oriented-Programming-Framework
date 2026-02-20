// ============================================================
// MotionBox — Vanilla DOM Component
//
// Creates a <div> with CSS transition styles derived from
// COIF Motion concepts (duration, easing, transition specs).
// Checks matchMedia('prefers-reduced-motion') to respect
// user accessibility preferences.
// ============================================================

import type {
  MotionDuration,
  MotionEasing,
  MotionTransition,
} from '../../shared/types.js';

import {
  motionToCSS,
} from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface MotionBoxProps {
  /** Named transitions to apply to this element */
  transitions: MotionTransition[];
  /** Available duration definitions */
  durations: MotionDuration[];
  /** Available easing definitions */
  easings: MotionEasing[];
  /** Whether motion is currently active (toggleable for demos) */
  active?: boolean;
  /** Force reduced motion regardless of system preference */
  forceReducedMotion?: boolean;
  /** Callback when a transition ends */
  onTransitionEnd?: (event: TransitionEvent) => void;
  /** Optional CSS class name */
  className?: string;
}

export interface MotionBoxOptions {
  target: HTMLElement;
  props: MotionBoxProps;
}

// --- Component ---

export class MotionBox {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: MotionBoxProps;
  private prefersReducedMotion: boolean;
  private mediaQuery: MediaQueryList | null = null;

  constructor(options: MotionBoxOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-motion', '');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Check system preference for reduced motion
    this.prefersReducedMotion = false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = this.mediaQuery.matches;

      const motionHandler = (e: MediaQueryListEvent) => {
        this.prefersReducedMotion = e.matches;
        this.applyTransitions();
      };

      this.mediaQuery.addEventListener('change', motionHandler);
      this.cleanup.push(() => {
        this.mediaQuery?.removeEventListener('change', motionHandler);
      });
    }

    // Listen for transitionend events
    if (props.onTransitionEnd) {
      const handler = (e: TransitionEvent) => {
        props.onTransitionEnd?.(e);
      };
      this.el.addEventListener('transitionend', handler);
      this.cleanup.push(() => this.el.removeEventListener('transitionend', handler));
    }

    this.applyTransitions();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<MotionBoxProps>): void {
    if (props.transitions !== undefined) this.props.transitions = props.transitions;
    if (props.durations !== undefined) this.props.durations = props.durations;
    if (props.easings !== undefined) this.props.easings = props.easings;
    if (props.active !== undefined) this.props.active = props.active;
    if (props.forceReducedMotion !== undefined) this.props.forceReducedMotion = props.forceReducedMotion;

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    // Re-bind transitionend if callback changed
    if (props.onTransitionEnd !== undefined) {
      this.props.onTransitionEnd = props.onTransitionEnd;
    }

    this.applyTransitions();
  }

  /** Trigger an active state toggle for demonstrating transitions */
  toggle(): void {
    this.props.active = !this.props.active;
    this.el.setAttribute('data-active', this.props.active ? 'true' : 'false');
    this.el.classList.toggle('coif-motion--active', this.props.active);
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

  private applyTransitions(): void {
    const shouldReduce = this.props.forceReducedMotion || this.prefersReducedMotion;

    this.el.setAttribute(
      'data-reduced-motion',
      shouldReduce ? 'true' : 'false',
    );

    if (shouldReduce) {
      // Apply near-instant transitions for reduced motion
      this.el.style.transition = 'all 0.01ms';
      return;
    }

    const { transitions, durations, easings } = this.props;

    if (!transitions || transitions.length === 0) {
      this.el.style.transition = '';
      return;
    }

    // Build the composite transition string from all MotionTransition specs
    const transitionParts = transitions.map((t) =>
      motionToCSS(t, durations, easings),
    );

    this.el.style.transition = transitionParts.join(', ');

    // Set active state
    if (this.props.active !== undefined) {
      this.el.setAttribute('data-active', this.props.active ? 'true' : 'false');
      this.el.classList.toggle('coif-motion--active', this.props.active);
    }
  }
}
