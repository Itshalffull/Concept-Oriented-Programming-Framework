// ============================================================
// ElementRenderer — Solid.js Component
//
// Form element renderer from ElementConfig. Maps Clef Surface element
// kinds to native HTML elements with proper attributes, roles,
// and accessibility markup. Supports nested groups and
// reactive value binding.
// ============================================================

import type {
  ElementConfig,
  ElementKind,
} from '../../shared/types.js';

import {
  mapElementToHTML,
  createSignal as surfaceCreateSignal,
} from '../../shared/surface-bridge.js';

import type { ElementRenderHint } from '../../shared/surface-bridge.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
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

export interface ElementRendererProps {
  config: ElementConfig;
  value?: unknown;
  disabled?: boolean;
  class?: string;
  onChange?: (value: unknown) => void;
  onAction?: (action: string) => void;
}

// --- Component Result ---

export interface ElementRendererResult {
  element: HTMLElement;
  dispose: () => void;
  getValue: () => unknown;
  setValue: (value: unknown) => void;
  setDisabled: (disabled: boolean) => void;
}

// --- Build a label element ---

function buildLabel(config: ElementConfig, forId: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.setAttribute('for', forId);
  label.textContent = config.label;

  if (config.required) {
    const required = document.createElement('span');
    required.textContent = ' *';
    required.setAttribute('aria-hidden', 'true');
    required.style.setProperty('color', 'var(--surface-error, #dc2626)');
    label.appendChild(required);
  }

  return label;
}

// --- Build constraint attributes ---

function applyConstraints(el: HTMLElement, config: ElementConfig): void {
  if (!config.constraints) return;

  const constraints = config.constraints;

  if (constraints.minLength !== undefined) {
    el.setAttribute('minlength', String(constraints.minLength));
  }
  if (constraints.maxLength !== undefined) {
    el.setAttribute('maxlength', String(constraints.maxLength));
  }
  if (constraints.min !== undefined) {
    el.setAttribute('min', String(constraints.min));
  }
  if (constraints.max !== undefined) {
    el.setAttribute('max', String(constraints.max));
  }
  if (constraints.step !== undefined) {
    el.setAttribute('step', String(constraints.step));
  }
  if (constraints.pattern !== undefined) {
    el.setAttribute('pattern', String(constraints.pattern));
  }
  if (constraints.placeholder !== undefined) {
    el.setAttribute('placeholder', String(constraints.placeholder));
  }
}

// --- Component ---

export function ElementRenderer(props: ElementRendererProps): ElementRendererResult {
  const [value, setValue] = solidCreateSignal<unknown>(props.value ?? '');
  const [disabled, setDisabled] = solidCreateSignal<boolean>(props.disabled ?? false);

  const config = props.config;
  const hint: ElementRenderHint = mapElementToHTML(config.kind);
  const elementId = `surface-el-${config.id}`;

  // Create wrapper
  const wrapper = document.createElement('div');
  wrapper.setAttribute('data-surface-widget', 'element-renderer');
  wrapper.setAttribute('data-element-kind', config.kind);
  wrapper.setAttribute('data-element-id', config.id);

  if (props.class) {
    wrapper.setAttribute('class', props.class);
  }

  // For group/container types, handle differently
  const isGroup = config.kind === 'group' || config.kind === 'container';
  const childDisposers: Array<() => void> = [];

  if (isGroup) {
    // Create a fieldset/div with nested children
    const groupEl = document.createElement(hint.tag);
    groupEl.setAttribute('data-surface-group', config.id);

    if (hint.role) {
      groupEl.setAttribute('role', hint.role);
    }

    // Legend/header for groups
    if (config.kind === 'group') {
      const legend = document.createElement('legend');
      legend.textContent = config.label;
      groupEl.appendChild(legend);
    }

    // Recursively render children
    if (config.children) {
      for (const childConfig of config.children) {
        const childResult = ElementRenderer({
          config: childConfig,
          disabled: props.disabled,
          onChange: props.onChange,
          onAction: props.onAction,
        });
        groupEl.appendChild(childResult.element);
        childDisposers.push(childResult.dispose);
      }
    }

    wrapper.appendChild(groupEl);
  } else {
    // Standard input/output elements

    // Add label (except for triggers/navigation)
    if (config.kind !== 'trigger' && config.kind !== 'navigation') {
      const label = buildLabel(config, elementId);
      wrapper.appendChild(label);
    }

    // Create the actual element
    const inputEl = document.createElement(hint.tag);
    inputEl.setAttribute('id', elementId);
    inputEl.setAttribute('name', config.id);

    if (hint.inputType) {
      inputEl.setAttribute('type', hint.inputType);
    }
    if (hint.role) {
      inputEl.setAttribute('role', hint.role);
    }
    if (config.required) {
      inputEl.setAttribute('required', '');
      inputEl.setAttribute('aria-required', 'true');
    }

    // Apply static attributes from hint
    for (const [attr, val] of Object.entries(hint.attributes)) {
      inputEl.setAttribute(attr, val);
    }

    // Apply constraints
    applyConstraints(inputEl, config);

    // Event handling based on element kind
    if (config.kind.startsWith('input-')) {
      // Input elements: bind value and listen for changes
      inputEl.addEventListener('input', (e: Event) => {
        const target = e.target as HTMLInputElement;
        let newValue: unknown;

        if (config.kind === 'input-bool') {
          newValue = target.checked;
        } else if (config.kind === 'input-number') {
          newValue = target.valueAsNumber;
        } else if (config.kind === 'input-date') {
          newValue = target.value;
        } else {
          newValue = target.value;
        }

        setValue(newValue);
        if (props.onChange) {
          props.onChange(newValue);
        }
      });
    } else if (config.kind.startsWith('selection-')) {
      // Selection elements
      inputEl.addEventListener('change', (e: Event) => {
        const target = e.target as HTMLSelectElement;
        let newValue: unknown;

        if (config.kind === 'selection-multi') {
          newValue = Array.from(target.selectedOptions).map(o => o.value);
        } else {
          newValue = target.value;
        }

        setValue(newValue);
        if (props.onChange) {
          props.onChange(newValue);
        }
      });

      // Populate options from constraints if available
      if (config.constraints && Array.isArray(config.constraints.options)) {
        for (const opt of config.constraints.options as Array<{ label: string; value: string }>) {
          const option = document.createElement('option');
          option.setAttribute('value', opt.value);
          option.textContent = opt.label;
          inputEl.appendChild(option);
        }
      }
    } else if (config.kind === 'trigger') {
      // Button elements
      inputEl.textContent = config.label;
      inputEl.addEventListener('click', () => {
        if (props.onAction) {
          props.onAction(config.id);
        }
        inputEl.dispatchEvent(
          new CustomEvent('surface:action', {
            bubbles: true,
            detail: { elementId: config.id, kind: config.kind },
          })
        );
      });
    } else if (config.kind === 'navigation') {
      inputEl.textContent = config.label;
      if (config.constraints && typeof config.constraints.href === 'string') {
        inputEl.setAttribute('href', config.constraints.href);
      }
    }

    // Reactive effect: sync value to DOM
    const disposeValue = solidCreateEffect([value as () => unknown], () => {
      const val = value();
      if (config.kind === 'input-bool') {
        (inputEl as HTMLInputElement).checked = Boolean(val);
      } else if (config.kind.startsWith('output-')) {
        inputEl.textContent = val != null ? String(val) : '';
      } else if ('value' in inputEl) {
        (inputEl as HTMLInputElement).value = val != null ? String(val) : '';
      }
    });
    childDisposers.push(disposeValue);

    // Reactive effect: sync disabled state
    const disposeDisabled = solidCreateEffect([disabled], () => {
      if (disabled()) {
        inputEl.setAttribute('disabled', '');
        inputEl.setAttribute('aria-disabled', 'true');
      } else {
        inputEl.removeAttribute('disabled');
        inputEl.removeAttribute('aria-disabled');
      }
    });
    childDisposers.push(disposeDisabled);

    wrapper.appendChild(inputEl);
  }

  function dispose() {
    for (const d of childDisposers) d();
    wrapper.remove();
  }

  return {
    element: wrapper,
    dispose,
    getValue: value,
    setValue: (v: unknown) => setValue(v),
    setDisabled: (d: boolean) => setDisabled(d),
  };
}
