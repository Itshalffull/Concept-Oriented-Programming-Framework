// ============================================================
// ElementRenderer — Vanilla DOM Component
//
// Creates the correct DOM element for each ElementKind
// (input, select, button, etc.) with proper attributes and
// ARIA roles. Handles nested groups/containers recursively.
// Uses the Clef Surface bridge's mapElementToHTML for tag resolution.
// ============================================================

import type {
  ElementConfig,
  ElementKind,
} from '../../shared/types.js';

import { mapElementToHTML } from '../../shared/surface-bridge.js';

// --- Public Interface ---

export interface ElementRendererProps {
  /** Element configuration from Clef Surface Element concept */
  config: ElementConfig;
  /** Callback when a value changes */
  onValueChange?: (id: string, value: unknown) => void;
  /** Callback when a trigger element is activated */
  onTrigger?: (id: string) => void;
  /** Whether the element is disabled */
  disabled?: boolean;
  /** Optional CSS class name */
  className?: string;
}

export interface ElementRendererOptions {
  target: HTMLElement;
  props: ElementRendererProps;
}

// --- Component ---

export class ElementRenderer {
  private el: HTMLElement;
  private cleanup: (() => void)[] = [];
  private props: ElementRendererProps;
  private childRenderers: ElementRenderer[] = [];

  constructor(options: ElementRendererOptions) {
    const { target, props } = options;
    this.props = props;

    this.el = this.createElement(props.config);

    if (props.className) {
      this.el.classList.add(props.className);
    }

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ElementRendererProps>): void {
    if (props.disabled !== undefined) {
      this.props.disabled = props.disabled;
      if (this.el instanceof HTMLInputElement ||
          this.el instanceof HTMLSelectElement ||
          this.el instanceof HTMLButtonElement) {
        (this.el as HTMLInputElement).disabled = props.disabled;
      }
      this.el.setAttribute('aria-disabled', String(props.disabled));
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (props.config !== undefined) {
      // Full re-render for config changes
      this.destroyChildren();
      const parent = this.el.parentNode;
      if (parent) {
        const newEl = this.createElement(props.config);
        parent.replaceChild(newEl, this.el);
        this.el = newEl;
      }
    }
  }

  destroy(): void {
    this.destroyChildren();

    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private createElement(config: ElementConfig): HTMLElement {
    const hint = mapElementToHTML(config.kind);

    const el = document.createElement(hint.tag);
    el.setAttribute('data-surface-element', config.kind);
    el.setAttribute('data-element-id', config.id);

    // Apply input type if applicable
    if (hint.inputType && el instanceof HTMLInputElement) {
      el.type = hint.inputType;
    }

    // Apply role
    if (hint.role) {
      el.setAttribute('role', hint.role);
    }

    // Apply additional attributes from the hint
    for (const [attr, val] of Object.entries(hint.attributes)) {
      el.setAttribute(attr, val);
    }

    // Apply ARIA label
    if (config.label) {
      el.setAttribute('aria-label', config.label);
    }

    // Apply required attribute
    if (config.required) {
      el.setAttribute('aria-required', 'true');
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        el.required = true;
      }
    }

    // Apply disabled state
    if (this.props.disabled) {
      el.setAttribute('aria-disabled', 'true');
      if (el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement ||
          el instanceof HTMLButtonElement) {
        (el as HTMLInputElement).disabled = true;
      }
    }

    // Apply constraints as data attributes
    if (config.constraints) {
      for (const [key, value] of Object.entries(config.constraints)) {
        if (typeof value === 'string' || typeof value === 'number') {
          el.setAttribute(`data-constraint-${key}`, String(value));

          // Map common constraints to native HTML attributes
          if (el instanceof HTMLInputElement) {
            switch (key) {
              case 'min': el.min = String(value); break;
              case 'max': el.max = String(value); break;
              case 'minLength': el.minLength = Number(value); break;
              case 'maxLength': el.maxLength = Number(value); break;
              case 'pattern': el.pattern = String(value); break;
              case 'step': el.step = String(value); break;
              case 'placeholder': el.placeholder = String(value); break;
            }
          }
        }
      }
    }

    // Add label element for form inputs
    this.attachLabel(el, config);

    // Attach event handlers based on element kind
    this.attachEventHandlers(el, config);

    // Handle container and group kinds with children
    if (config.children && config.children.length > 0) {
      this.renderChildren(el, config);
    }

    return el;
  }

  private attachLabel(el: HTMLElement, config: ElementConfig): void {
    // For group elements, add a legend
    if (config.kind === 'group' && el.tagName === 'FIELDSET') {
      const legend = document.createElement('legend');
      legend.textContent = config.label;
      el.insertBefore(legend, el.firstChild);
      return;
    }

    // For input-like elements, wrap with a label container
    const needsLabel = config.kind.startsWith('input-') ||
                       config.kind.startsWith('selection-');
    if (needsLabel && config.label) {
      // We set the aria-label above; a visible label would be
      // added by the form-level component (UISchemaForm).
      // Here we just ensure accessibility.
      el.setAttribute('aria-label', config.label);
    }
  }

  private attachEventHandlers(el: HTMLElement, config: ElementConfig): void {
    const { onValueChange, onTrigger } = this.props;

    // Input change handler
    if (config.kind.startsWith('input-') || config.kind.startsWith('selection-')) {
      const handler = (event: Event) => {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        let value: unknown;

        if (config.kind === 'input-bool' && target instanceof HTMLInputElement) {
          value = target.checked;
        } else if (config.kind === 'input-number' && target instanceof HTMLInputElement) {
          value = target.valueAsNumber;
        } else if (config.kind === 'input-date' && target instanceof HTMLInputElement) {
          value = target.valueAsDate;
        } else if (config.kind === 'selection-multi' && target instanceof HTMLSelectElement) {
          value = Array.from(target.selectedOptions).map((o) => o.value);
        } else {
          value = (target as HTMLInputElement).value;
        }

        onValueChange?.(config.id, value);
      };

      const eventType = config.kind.startsWith('selection-') ? 'change' : 'input';
      el.addEventListener(eventType, handler);
      this.cleanup.push(() => el.removeEventListener(eventType, handler));
    }

    // Trigger (button) click handler
    if (config.kind === 'trigger') {
      const handler = () => {
        onTrigger?.(config.id);
      };
      el.addEventListener('click', handler);
      this.cleanup.push(() => el.removeEventListener('click', handler));

      // Set button text
      if (el instanceof HTMLButtonElement) {
        el.textContent = config.label;
      }
    }

    // Navigation link
    if (config.kind === 'navigation') {
      const href = config.constraints?.['href'];
      if (typeof href === 'string') {
        el.setAttribute('href', href);
      }
      el.textContent = config.label;
    }

    // Output elements
    if (config.kind.startsWith('output-')) {
      el.textContent = config.label;
    }
  }

  private renderChildren(parent: HTMLElement, config: ElementConfig): void {
    if (!config.children) return;

    for (const childConfig of config.children) {
      const childRenderer = new ElementRenderer({
        target: parent,
        props: {
          config: childConfig,
          onValueChange: this.props.onValueChange,
          onTrigger: this.props.onTrigger,
          disabled: this.props.disabled,
        },
      });
      this.childRenderers.push(childRenderer);
    }
  }

  private destroyChildren(): void {
    for (const child of this.childRenderers) {
      child.destroy();
    }
    this.childRenderers.length = 0;
  }
}
