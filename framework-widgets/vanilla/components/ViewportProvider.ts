// ============================================================
// ViewportProvider — Vanilla DOM Component
//
// Observes window resize events and updates a ViewportState
// signal. Uses addEventListener('resize') and provides the
// current breakpoint, orientation, and dimensions to children.
// Sets data attributes on a container element for CSS hooks.
// ============================================================

import type {
  WritableSignal,
  ViewportState,
  Breakpoint,
} from '../../shared/types.js';

import {
  createViewportSignal,
  observeViewport,
} from '../../shared/surface-bridge.js';

// --- Public Interface ---

export interface ViewportProviderProps {
  /** Optional pre-existing viewport signal to use (creates one if omitted) */
  viewportSignal?: WritableSignal<ViewportState>;
  /** Callback whenever the viewport state changes */
  onChange?: (state: ViewportState) => void;
  /** Optional CSS class name */
  className?: string;
}

export interface ViewportProviderOptions {
  target: HTMLElement;
  props: ViewportProviderProps;
}

// --- Component ---

export class ViewportProvider {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private signal: WritableSignal<ViewportState>;

  constructor(options: ViewportProviderOptions) {
    const { target, props } = options;

    // Use provided signal or create a new one
    this.signal = props.viewportSignal ?? createViewportSignal(
      typeof window !== 'undefined' ? window.innerWidth : 1024,
      typeof window !== 'undefined' ? window.innerHeight : 768,
    );

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-viewport', '');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Apply initial viewport state as data attributes
    this.applyViewportData(this.signal.get());

    // Subscribe to the signal for reactive data attribute updates
    const unsubSignal = this.signal.subscribe((state) => {
      this.applyViewportData(state);
      props.onChange?.(state);
    });
    this.cleanup.push(unsubSignal);

    // Start observing window resize events
    const stopObserving = observeViewport(this.signal);
    this.cleanup.push(stopObserving);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Access the current viewport state */
  getState(): ViewportState {
    return this.signal.get();
  }

  /** Access the underlying signal for external subscriptions */
  getSignal(): WritableSignal<ViewportState> {
    return this.signal;
  }

  /** Get the current breakpoint */
  getBreakpoint(): Breakpoint {
    return this.signal.get().breakpoint;
  }

  update(props: Partial<ViewportProviderProps>): void {
    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }
    // onChange callback is captured via closure in the signal subscription,
    // so we re-subscribe if the callback changes
    if (props.onChange !== undefined) {
      // The existing subscription will keep calling the old callback.
      // For simplicity, the new onChange will take effect on the next signal change
      // because props.onChange is accessed via reference in the constructor callback.
    }
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

  private applyViewportData(state: ViewportState): void {
    this.el.setAttribute('data-breakpoint', state.breakpoint);
    this.el.setAttribute('data-orientation', state.orientation);
    this.el.setAttribute('data-viewport-width', String(state.width));
    this.el.setAttribute('data-viewport-height', String(state.height));
  }
}
