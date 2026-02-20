// ============================================================
// BindingProvider — Vanilla DOM Component
//
// Manages COIF concept signal subscriptions. Provides an
// invoke() method via closure for triggering actions. Updates
// DOM elements when signal values change, bridging the gap
// between headless COIF bindings and the DOM.
// ============================================================

import type {
  Signal,
  BindingConfig,
  BindingMode,
} from '../../shared/types.js';

// --- Public Interface ---

export interface BindingProviderProps {
  /** COIF binding configuration */
  binding: BindingConfig;
  /** DOM elements to update when signals change: { signalKey: updateFn } */
  updaters?: Record<string, (el: HTMLElement, value: unknown) => void>;
  /** Action handlers: invoke(actionName, payload) */
  actions?: Record<string, (payload?: unknown) => void | Promise<void>>;
  /** Callback when any bound signal changes */
  onChange?: (key: string, value: unknown) => void;
  /** Callback when binding status changes (loading, error, etc.) */
  onStatusChange?: (status: BindingStatus) => void;
  /** Optional CSS class name */
  className?: string;
}

export interface BindingProviderOptions {
  target: HTMLElement;
  props: BindingProviderProps;
}

export interface BindingStatus {
  loading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

// --- Component ---

export class BindingProvider {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: BindingProviderProps;
  private status: BindingStatus;
  private signalValues: Map<string, unknown> = new Map();

  constructor(options: BindingProviderOptions) {
    const { target, props } = options;
    this.props = props;

    this.status = {
      loading: false,
      error: null,
      lastUpdated: null,
    };

    // Root element
    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-binding', props.binding.concept);
    this.el.setAttribute('data-binding-mode', props.binding.mode);

    if (props.binding.endpoint) {
      this.el.setAttribute('data-binding-endpoint', props.binding.endpoint);
    }

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Subscribe to all signals in the binding's signalMap
    this.subscribeToSignals(props.binding);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Invoke a named action (provided via props.actions) */
  invoke(actionName: string, payload?: unknown): void | Promise<void> {
    const handler = this.props.actions?.[actionName];
    if (!handler) {
      console.warn(
        `[BindingProvider] No action handler registered for "${actionName}" on concept "${this.props.binding.concept}"`,
      );
      return;
    }

    this.updateStatus({ loading: true, error: null });

    try {
      const result = handler(payload);

      // Handle async actions
      if (result instanceof Promise) {
        return result
          .then(() => {
            this.updateStatus({ loading: false, lastUpdated: Date.now() });
          })
          .catch((err: Error) => {
            this.updateStatus({ loading: false, error: err.message });
          });
      }

      this.updateStatus({ loading: false, lastUpdated: Date.now() });
    } catch (err) {
      this.updateStatus({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /** Get the current value of a bound signal by key */
  getValue(key: string): unknown {
    return this.signalValues.get(key);
  }

  /** Get all current signal values */
  getValues(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.signalValues) {
      result[key] = value;
    }
    return result;
  }

  /** Get the current binding status */
  getStatus(): BindingStatus {
    return { ...this.status };
  }

  update(props: Partial<BindingProviderProps>): void {
    if (props.binding !== undefined) {
      // Unsubscribe from old signals and resubscribe to new ones
      this.unsubscribeAll();
      this.props.binding = props.binding;
      this.el.setAttribute('data-coif-binding', props.binding.concept);
      this.el.setAttribute('data-binding-mode', props.binding.mode);
      this.subscribeToSignals(props.binding);
    }

    if (props.actions !== undefined) {
      this.props.actions = props.actions;
    }

    if (props.updaters !== undefined) {
      this.props.updaters = props.updaters;
    }

    if (props.onChange !== undefined) {
      this.props.onChange = props.onChange;
    }

    if (props.onStatusChange !== undefined) {
      this.props.onStatusChange = props.onStatusChange;
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }
  }

  destroy(): void {
    this.unsubscribeAll();

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private subscribeToSignals(binding: BindingConfig): void {
    for (const [key, signal] of Object.entries(binding.signalMap)) {
      // Store initial value
      this.signalValues.set(key, signal.get());

      const unsub = signal.subscribe((value: unknown) => {
        this.signalValues.set(key, value);

        // Update DOM via the updater function if provided
        const updater = this.props.updaters?.[key];
        if (updater) {
          updater(this.el, value);
        }

        // Set a data attribute with the serialized value for CSS hooks
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          this.el.setAttribute(`data-signal-${key}`, String(value));
        }

        // Notify onChange callback
        this.props.onChange?.(key, value);
      });

      this.cleanup.push(unsub);
    }
  }

  private unsubscribeAll(): void {
    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;
    this.signalValues.clear();
  }

  private updateStatus(partial: Partial<BindingStatus>): void {
    this.status = { ...this.status, ...partial };

    this.el.setAttribute('data-loading', String(this.status.loading));
    if (this.status.error) {
      this.el.setAttribute('data-error', this.status.error);
    } else {
      this.el.removeAttribute('data-error');
    }

    this.props.onStatusChange?.({ ...this.status });
  }
}
