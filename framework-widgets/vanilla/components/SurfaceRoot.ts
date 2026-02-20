// ============================================================
// SurfaceRoot — Vanilla DOM Component
//
// Creates and manages the root mount point for a COIF
// application surface. Handles surface lifecycle including
// mount, unmount, and hydration. Provides the top-level
// container that other COIF components render into.
// ============================================================

import type {
  SurfaceKind,
} from '../../shared/types.js';

// --- Public Interface ---

export interface SurfaceRootProps {
  /** The surface kind (browser-dom is the primary target for vanilla) */
  kind: SurfaceKind;
  /** Root element ID or an existing element to mount into */
  rootId?: string;
  /** Application title (set on document.title) */
  title?: string;
  /** Whether to hydrate existing server-rendered markup */
  hydrate?: boolean;
  /** Callback when the surface is mounted and ready */
  onMount?: (root: HTMLElement) => void;
  /** Callback when the surface is about to unmount */
  onUnmount?: () => void;
  /** Callback on unhandled errors within the surface */
  onError?: (error: Error) => void;
  /** Optional CSS class name for the root element */
  className?: string;
}

export interface SurfaceRootOptions {
  target: HTMLElement;
  props: SurfaceRootProps;
}

export type SurfaceLifecycle = 'idle' | 'mounting' | 'mounted' | 'unmounting' | 'unmounted' | 'error';

// --- Component ---

export class SurfaceRoot {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: SurfaceRootProps;
  private lifecycle: SurfaceLifecycle = 'idle';
  private errorBoundaryHandler: ((event: ErrorEvent) => void) | null = null;
  private rejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

  constructor(options: SurfaceRootOptions) {
    const { target, props } = options;
    this.props = props;

    // Resolve or create the root element
    if (props.rootId) {
      const existing = document.getElementById(props.rootId);
      if (existing) {
        this.el = existing;
      } else {
        this.el = document.createElement('div');
        this.el.id = props.rootId;
        target.appendChild(this.el);
      }
    } else {
      this.el = document.createElement('div');
      target.appendChild(this.el);
    }

    this.el.setAttribute('data-coif-surface', props.kind);
    this.el.setAttribute('data-surface-lifecycle', 'idle');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Set document title
    if (props.title && typeof document !== 'undefined') {
      document.title = props.title;
    }

    // Set up global error boundary
    this.setupErrorBoundary(props.onError);

    // Mount the surface
    this.mount(props);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Get the current lifecycle state */
  getLifecycle(): SurfaceLifecycle {
    return this.lifecycle;
  }

  /** Check if the surface is currently mounted */
  isMounted(): boolean {
    return this.lifecycle === 'mounted';
  }

  update(props: Partial<SurfaceRootProps>): void {
    if (props.title !== undefined) {
      this.props.title = props.title;
      if (typeof document !== 'undefined') {
        document.title = props.title;
      }
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.onMount !== undefined) {
      this.props.onMount = props.onMount;
    }

    if (props.onUnmount !== undefined) {
      this.props.onUnmount = props.onUnmount;
    }

    if (props.onError !== undefined) {
      this.props.onError = props.onError;
      this.teardownErrorBoundary();
      this.setupErrorBoundary(props.onError);
    }
  }

  /** Manually trigger a re-mount (useful for hot-reload scenarios) */
  remount(): void {
    this.unmount();
    this.mount(this.props);
  }

  destroy(): void {
    this.unmount();
    this.teardownErrorBoundary();

    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    // Only remove from DOM if we created the element
    if (!this.props.rootId && this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private mount(props: SurfaceRootProps): void {
    this.setLifecycle('mounting');

    if (props.hydrate) {
      // Hydration mode: preserve existing DOM content, just attach behaviors
      this.el.setAttribute('data-hydrated', 'true');
    }

    // Set up a MutationObserver to track content changes
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        // Track child list changes for debugging/logging
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            this.el.setAttribute(
              'data-child-count',
              String(this.el.children.length),
            );
          }
        }
      });

      observer.observe(this.el, { childList: true, subtree: false });
      this.cleanup.push(() => observer.disconnect());
    }

    // Set up visibility change handler for lifecycle
    if (typeof document !== 'undefined') {
      const visibilityHandler = () => {
        this.el.setAttribute(
          'data-visible',
          String(!document.hidden),
        );
      };
      document.addEventListener('visibilitychange', visibilityHandler);
      this.cleanup.push(() => {
        document.removeEventListener('visibilitychange', visibilityHandler);
      });
    }

    // Set up beforeunload handler for cleanup
    if (typeof window !== 'undefined') {
      const unloadHandler = () => {
        this.unmount();
      };
      window.addEventListener('beforeunload', unloadHandler);
      this.cleanup.push(() => {
        window.removeEventListener('beforeunload', unloadHandler);
      });
    }

    this.setLifecycle('mounted');
    props.onMount?.(this.el);
  }

  private unmount(): void {
    if (this.lifecycle === 'unmounted' || this.lifecycle === 'unmounting') {
      return;
    }

    this.setLifecycle('unmounting');
    this.props.onUnmount?.();

    // Clear all child content (but keep the element itself)
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }

    this.setLifecycle('unmounted');
  }

  private setLifecycle(state: SurfaceLifecycle): void {
    this.lifecycle = state;
    this.el.setAttribute('data-surface-lifecycle', state);
  }

  private setupErrorBoundary(onError?: (error: Error) => void): void {
    if (typeof window === 'undefined') return;

    this.errorBoundaryHandler = (event: ErrorEvent) => {
      this.setLifecycle('error');
      this.el.setAttribute('data-error', event.message);

      if (onError) {
        onError(event.error ?? new Error(event.message));
      } else {
        console.error('[SurfaceRoot] Unhandled error:', event.error ?? event.message);
      }
    };

    this.rejectionHandler = (event: PromiseRejectionEvent) => {
      this.setLifecycle('error');
      const errorMsg = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);
      this.el.setAttribute('data-error', errorMsg);

      if (onError) {
        onError(
          event.reason instanceof Error
            ? event.reason
            : new Error(errorMsg),
        );
      }
    };

    window.addEventListener('error', this.errorBoundaryHandler);
    window.addEventListener('unhandledrejection', this.rejectionHandler);

    this.cleanup.push(() => this.teardownErrorBoundary());
  }

  private teardownErrorBoundary(): void {
    if (typeof window === 'undefined') return;

    if (this.errorBoundaryHandler) {
      window.removeEventListener('error', this.errorBoundaryHandler);
      this.errorBoundaryHandler = null;
    }

    if (this.rejectionHandler) {
      window.removeEventListener('unhandledrejection', this.rejectionHandler);
      this.rejectionHandler = null;
    }
  }
}
