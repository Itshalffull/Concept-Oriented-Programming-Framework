// ============================================================
// WidgetMachine — Vanilla DOM Component
//
// Creates DOM elements from machine anatomy parts. Subscribes
// to the machine state signal for reactive updates. Uses
// addEventListener for events and translates connect() props
// to setAttribute/addEventListener calls on each part element.
// ============================================================

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
  Signal,
} from '../../shared/types.js';

import { createMachine } from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface WidgetMachineProps {
  /** The COIF widget specification */
  spec: WidgetSpec;
  /** Initial context to seed the machine */
  initialContext?: Record<string, unknown>;
  /** Map of part names to their HTML tag overrides (defaults to 'div') */
  partTags?: Record<string, string>;
  /** Callback when the machine state changes */
  onStateChange?: (state: MachineState) => void;
  /** Event handlers to bind to anatomy parts: { partName: { eventName: handler } } */
  partEvents?: Record<string, Record<string, EventListener>>;
  /** Optional CSS class name */
  className?: string;
}

export interface WidgetMachineOptions {
  target: HTMLElement;
  props: WidgetMachineProps;
}

// --- Component ---

export class WidgetMachine {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: WidgetMachineProps;
  private machine: ReturnType<typeof createMachine>;
  private partElements: Map<string, HTMLElement> = new Map();

  constructor(options: WidgetMachineOptions) {
    const { target, props } = options;
    this.props = props;

    // Create the headless machine from the COIF spec
    this.machine = createMachine(props.spec, props.initialContext);

    // Root element
    this.el = document.createElement('div');
    this.el.setAttribute('data-coif-widget', props.spec.name);
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('aria-label', props.spec.name);

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Create DOM elements for each anatomy part
    this.createParts(props.spec, props.partTags);

    // Apply initial connected props
    this.applyConnectedProps();

    // Bind custom part events
    this.bindPartEvents(props.partEvents);

    // Subscribe to machine state signal for live updates
    const unsub = this.machine.state.subscribe((state) => {
      this.applyConnectedProps();
      props.onStateChange?.(state);
    });
    this.cleanup.push(unsub);

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  /** Get a specific anatomy part element by name */
  getPart(name: string): HTMLElement | undefined {
    return this.partElements.get(name);
  }

  /** Send an event to the underlying state machine */
  send(event: { type: string; [key: string]: unknown }): void {
    this.machine.send(event);
  }

  /** Get the current machine state */
  getState(): MachineState {
    return this.machine.state.get();
  }

  /** Access the machine state signal for external subscriptions */
  getStateSignal(): Signal<MachineState> {
    return this.machine.state;
  }

  update(props: Partial<WidgetMachineProps>): void {
    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.partEvents !== undefined) {
      // Unbind old event handlers (those tracked in cleanup from partEvents)
      // and rebind new ones
      this.bindPartEvents(props.partEvents);
    }

    if (props.onStateChange !== undefined) {
      this.props.onStateChange = props.onStateChange;
    }
  }

  destroy(): void {
    // Destroy the headless machine
    this.machine.destroy();

    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    this.partElements.clear();

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private createParts(
    spec: WidgetSpec,
    partTags?: Record<string, string>,
  ): void {
    for (const partName of spec.anatomy.parts) {
      const tag = partTags?.[partName] ?? 'div';
      const partEl = document.createElement(tag);
      partEl.setAttribute('data-part', partName);
      partEl.setAttribute('data-coif-part', partName);

      this.partElements.set(partName, partEl);
      this.el.appendChild(partEl);
    }

    // Create slot placeholders if defined
    if (spec.anatomy.slots) {
      for (const slotName of spec.anatomy.slots) {
        const slotEl = document.createElement('div');
        slotEl.setAttribute('data-slot', slotName);
        slotEl.setAttribute('data-coif-slot', slotName);
        this.el.appendChild(slotEl);
      }
    }
  }

  private applyConnectedProps(): void {
    const connected: ConnectedProps = this.machine.connect();

    for (const [partName, props] of Object.entries(connected)) {
      const partEl = this.partElements.get(partName);
      if (!partEl) continue;

      for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) {
          partEl.removeAttribute(key);
          continue;
        }

        if (key.startsWith('on')) {
          // Event handlers from connect() — these are usually state-machine-driven
          // They are functions attached via connect(), translate to addEventListener
          if (typeof value === 'function') {
            const eventName = key.slice(2).toLowerCase();
            // Remove previous handler if exists
            const prevHandler = (partEl as any)[`__coif_${eventName}`];
            if (prevHandler) {
              partEl.removeEventListener(eventName, prevHandler);
            }
            partEl.addEventListener(eventName, value as EventListener);
            (partEl as any)[`__coif_${eventName}`] = value;
          }
        } else if (key === 'style' && typeof value === 'object') {
          // Style object
          for (const [sk, sv] of Object.entries(value as Record<string, string>)) {
            partEl.style.setProperty(sk, sv);
          }
        } else if (key === 'className') {
          partEl.classList.add(String(value));
        } else if (typeof value === 'boolean') {
          if (value) {
            partEl.setAttribute(key, '');
          } else {
            partEl.removeAttribute(key);
          }
        } else {
          partEl.setAttribute(key, String(value));
        }
      }
    }
  }

  private bindPartEvents(
    partEvents?: Record<string, Record<string, EventListener>>,
  ): void {
    if (!partEvents) return;

    for (const [partName, events] of Object.entries(partEvents)) {
      const partEl = this.partElements.get(partName);
      if (!partEl) continue;

      for (const [eventName, handler] of Object.entries(events)) {
        // Remove any previously bound handler with the same key
        const storageKey = `__coif_user_${eventName}`;
        const prev = (partEl as any)[storageKey];
        if (prev) {
          partEl.removeEventListener(eventName, prev);
        }

        partEl.addEventListener(eventName, handler);
        (partEl as any)[storageKey] = handler;

        this.cleanup.push(() => {
          partEl.removeEventListener(eventName, handler);
          delete (partEl as any)[storageKey];
        });
      }
    }
  }
}
