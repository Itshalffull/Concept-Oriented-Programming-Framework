// ============================================================
// ElementRenderer — Svelte-compatible COIF component
//
// Renders form elements from COIF ElementConfig. Maps each
// ElementKind to the appropriate HTML element, input type,
// ARIA role, and attributes. Supports nested children (groups,
// containers) and reactive value binding.
// ============================================================

import type {
  ElementConfig,
  ElementKind,
  WritableSignal,
} from '../../shared/types.js';

import {
  mapElementToHTML,
  createSignal,
} from '../../shared/coif-bridge.js';

import type { ElementRenderHint } from '../../shared/coif-bridge.js';

// --- Component types ---

export interface ElementRendererProps {
  config: ElementConfig;
  value?: unknown;
  disabled?: boolean;
  className?: string;
  'on:change'?: (event: { id: string; value: unknown }) => void;
  'on:input'?: (event: { id: string; value: unknown }) => void;
  'on:trigger'?: (event: { id: string }) => void;
}

export interface ElementRendererInstance {
  update(props: Partial<ElementRendererProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  getValue(): unknown;
  setValue(value: unknown): void;
}

export interface ElementRendererOptions {
  target: HTMLElement;
  props: ElementRendererProps;
}

// --- Helpers ---

function extractValue(element: HTMLElement, kind: ElementKind): unknown {
  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') return element.checked;
    if (element.type === 'number') return element.valueAsNumber;
    if (element.type === 'date') return element.value;
    if (element.type === 'file') return element.files;
    return element.value;
  }
  if (element instanceof HTMLSelectElement) {
    if (element.multiple) {
      return Array.from(element.selectedOptions).map(o => o.value);
    }
    return element.value;
  }
  if (kind === 'rich-text') {
    return element.innerHTML;
  }
  return element.textContent;
}

function applyValue(element: HTMLElement, value: unknown, kind: ElementKind): void {
  if (value === undefined || value === null) return;

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox') {
      element.checked = Boolean(value);
    } else {
      element.value = String(value);
    }
  } else if (element instanceof HTMLSelectElement) {
    if (Array.isArray(value)) {
      for (const option of Array.from(element.options)) {
        option.selected = value.includes(option.value);
      }
    } else {
      element.value = String(value);
    }
  } else if (kind === 'rich-text') {
    element.innerHTML = String(value);
  } else if (isOutputKind(kind)) {
    element.textContent = String(value);
  }
}

function isOutputKind(kind: ElementKind): boolean {
  return kind.startsWith('output-');
}

function isInputKind(kind: ElementKind): boolean {
  return kind.startsWith('input-') || kind.startsWith('selection-') || kind === 'rich-text' || kind === 'file-upload';
}

// --- Component factory ---

export function createElementRenderer(
  options: ElementRendererOptions,
): ElementRendererInstance {
  const { target } = options;
  let { config, disabled = false, className } = options.props;
  let onChange = options.props['on:change'];
  let onInput = options.props['on:input'];
  let onTrigger = options.props['on:trigger'];

  // Reactive value — mirrors $state rune
  const value$ = createSignal<unknown>(options.props.value ?? '');

  // Track child instances for groups/containers
  let childInstances: ElementRendererInstance[] = [];
  let eventCleanups: Array<() => void> = [];

  // Create wrapper div
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-coif-element', '');
  wrapper.setAttribute('data-element-id', config.id);
  wrapper.setAttribute('data-element-kind', config.kind);
  if (className) wrapper.className = className;
  target.appendChild(wrapper);

  // The actual rendered element reference
  let renderedElement: HTMLElement | null = null;

  function render(): void {
    // Clean up
    for (const cleanup of eventCleanups) cleanup();
    eventCleanups = [];
    for (const child of childInstances) child.destroy();
    childInstances = [];
    wrapper.innerHTML = '';

    const hint: ElementRenderHint = mapElementToHTML(config.kind);

    // Render label for input elements
    if (isInputKind(config.kind) || config.kind === 'trigger') {
      const label = document.createElement('label');
      label.setAttribute('for', `coif-el-${config.id}`);
      label.textContent = config.label;
      label.style.cssText = 'display: block; margin-bottom: 0.25em; font-size: 0.875em;';

      if (config.required) {
        const required = document.createElement('span');
        required.textContent = ' *';
        required.setAttribute('aria-hidden', 'true');
        required.style.color = 'var(--color-error, #dc2626)';
        label.appendChild(required);
      }

      wrapper.appendChild(label);
    }

    // Create the element
    const el = document.createElement(hint.tag) as HTMLElement;
    el.id = `coif-el-${config.id}`;
    renderedElement = el;

    // Apply input type
    if (hint.inputType && el instanceof HTMLInputElement) {
      el.type = hint.inputType;
    }

    // Apply role
    if (hint.role) {
      el.setAttribute('role', hint.role);
    }

    // Apply extra attributes
    for (const [attr, val] of Object.entries(hint.attributes)) {
      el.setAttribute(attr, val);
    }

    // Apply constraints as HTML validation attributes
    if (config.constraints) {
      for (const [key, val] of Object.entries(config.constraints)) {
        if (val !== undefined && val !== null) {
          el.setAttribute(key, String(val));
        }
      }
    }

    // Disabled state
    if (disabled) {
      el.setAttribute('disabled', '');
      el.setAttribute('aria-disabled', 'true');
    }

    // Required attribute
    if (config.required && isInputKind(config.kind)) {
      el.setAttribute('required', '');
      el.setAttribute('aria-required', 'true');
    }

    // Apply current value
    applyValue(el, value$.get(), config.kind);

    // Style output elements
    if (isOutputKind(config.kind)) {
      el.textContent = String(value$.get() ?? '');
    }

    // Trigger elements get their label as text content
    if (config.kind === 'trigger') {
      el.textContent = config.label;
    }

    // Navigation elements
    if (config.kind === 'navigation') {
      el.textContent = config.label;
    }

    // Bind events
    if (isInputKind(config.kind)) {
      const handleInput = () => {
        const newValue = extractValue(el, config.kind);
        (value$ as WritableSignal<unknown>).set(newValue);
        onInput?.({ id: config.id, value: newValue });
      };
      const handleChange = () => {
        const newValue = extractValue(el, config.kind);
        (value$ as WritableSignal<unknown>).set(newValue);
        onChange?.({ id: config.id, value: newValue });
      };

      el.addEventListener('input', handleInput);
      el.addEventListener('change', handleChange);
      eventCleanups.push(
        () => el.removeEventListener('input', handleInput),
        () => el.removeEventListener('change', handleChange),
      );
    }

    if (config.kind === 'trigger') {
      const handleClick = () => {
        onTrigger?.({ id: config.id });
      };
      el.addEventListener('click', handleClick);
      eventCleanups.push(() => el.removeEventListener('click', handleClick));
    }

    wrapper.appendChild(el);

    // Render children for group/container elements
    if (config.children && (config.kind === 'group' || config.kind === 'container')) {
      // For fieldset (group), add a legend
      if (config.kind === 'group' && el.tagName === 'FIELDSET') {
        const legend = document.createElement('legend');
        legend.textContent = config.label;
        el.appendChild(legend);
      }

      for (const childConfig of config.children) {
        const childInstance = createElementRenderer({
          target: el,
          props: {
            config: childConfig,
            disabled,
            'on:change': onChange,
            'on:input': onInput,
            'on:trigger': onTrigger,
          },
        });
        childInstances.push(childInstance);
      }
    }
  }

  // Subscribe to external value changes
  const unsubscribeValue = value$.subscribe((val) => {
    if (renderedElement) {
      applyValue(renderedElement, val, config.kind);
    }
  });

  // Initial render
  render();

  return {
    get element() { return wrapper; },

    getValue(): unknown {
      return value$.get();
    },

    setValue(value: unknown): void {
      (value$ as WritableSignal<unknown>).set(value);
    },

    update(newProps: Partial<ElementRendererProps>): void {
      let needsRender = false;

      if (newProps.config !== undefined) { config = newProps.config; needsRender = true; }
      if (newProps.disabled !== undefined) { disabled = newProps.disabled; needsRender = true; }
      if (newProps['on:change'] !== undefined) { onChange = newProps['on:change']; needsRender = true; }
      if (newProps['on:input'] !== undefined) { onInput = newProps['on:input']; needsRender = true; }
      if (newProps['on:trigger'] !== undefined) { onTrigger = newProps['on:trigger']; needsRender = true; }
      if (newProps.className !== undefined) {
        className = newProps.className;
        wrapper.className = className ?? '';
      }
      if (newProps.value !== undefined) {
        (value$ as WritableSignal<unknown>).set(newProps.value);
      }

      if (needsRender) render();
    },

    destroy(): void {
      unsubscribeValue();
      for (const cleanup of eventCleanups) cleanup();
      for (const child of childInstances) child.destroy();
      wrapper.remove();
    },
  };
}
