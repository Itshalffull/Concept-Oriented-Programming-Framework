// ============================================================
// UISchemaForm — Svelte-compatible Clef Surface component
//
// Auto-generates a complete form from a Clef Surface UISchema definition.
// Iterates over the schema's fields and renders each via
// ElementRenderer. Manages form-level state, validation, and
// submission. Supports multiple views (list, detail, create, edit).
// ============================================================

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
  ElementConfig,
  WritableSignal,
} from '../../shared/types.js';

import { createSignal } from '../../shared/surface-bridge.js';

import {
  createElementRenderer,
  type ElementRendererInstance,
} from './ElementRenderer.js';

// --- Component types ---

export type FormViewMode = 'list' | 'detail' | 'create' | 'edit';

export interface UISchemaFormProps {
  schema: UISchema;
  viewMode?: FormViewMode;
  initialValues?: Record<string, unknown>;
  disabled?: boolean;
  className?: string;
  'on:submit'?: (event: { values: Record<string, unknown>; concept: string }) => void;
  'on:change'?: (event: { field: string; value: unknown; values: Record<string, unknown> }) => void;
  'on:validate'?: (event: { values: Record<string, unknown>; errors: Record<string, string> }) => void;
}

export interface UISchemaFormInstance {
  update(props: Partial<UISchemaFormProps>): void;
  destroy(): void;
  readonly element: HTMLElement;
  getValues(): Record<string, unknown>;
  setValues(values: Record<string, unknown>): void;
  validate(): Record<string, string>;
  reset(): void;
}

export interface UISchemaFormOptions {
  target: HTMLElement;
  props: UISchemaFormProps;
}

// --- Helpers ---

function fieldToElementConfig(field: UISchemaField): ElementConfig {
  return {
    id: field.name,
    kind: field.element,
    label: field.label,
    dataType: field.dataType,
    required: field.required,
    constraints: field.constraints,
  };
}

function getView(schema: UISchema, mode: FormViewMode): UISchemaView | undefined {
  return schema.views[mode];
}

function validateField(field: UISchemaField, value: unknown): string | null {
  // Required check
  if (field.required) {
    if (value === undefined || value === null || value === '') {
      return `${field.label} is required`;
    }
  }

  // Type-specific constraints
  if (field.constraints) {
    if (field.constraints.minLength && typeof value === 'string') {
      if (value.length < (field.constraints.minLength as number)) {
        return `${field.label} must be at least ${field.constraints.minLength} characters`;
      }
    }
    if (field.constraints.maxLength && typeof value === 'string') {
      if (value.length > (field.constraints.maxLength as number)) {
        return `${field.label} must be at most ${field.constraints.maxLength} characters`;
      }
    }
    if (field.constraints.min !== undefined && typeof value === 'number') {
      if (value < (field.constraints.min as number)) {
        return `${field.label} must be at least ${field.constraints.min}`;
      }
    }
    if (field.constraints.max !== undefined && typeof value === 'number') {
      if (value > (field.constraints.max as number)) {
        return `${field.label} must be at most ${field.constraints.max}`;
      }
    }
    if (field.constraints.pattern && typeof value === 'string') {
      const regex = new RegExp(field.constraints.pattern as string);
      if (!regex.test(value)) {
        return `${field.label} format is invalid`;
      }
    }
  }

  return null;
}

// --- Component factory ---

export function createUISchemaForm(
  options: UISchemaFormOptions,
): UISchemaFormInstance {
  const { target } = options;
  let {
    schema,
    viewMode = 'create',
    initialValues = {},
    disabled = false,
    className,
  } = options.props;
  let onSubmit = options.props['on:submit'];
  let onChange = options.props['on:change'];
  let onValidate = options.props['on:validate'];

  // Reactive form values — mirrors $state rune
  const values$ = createSignal<Record<string, unknown>>({ ...initialValues });

  // Form errors — mirrors $state rune
  const errors$ = createSignal<Record<string, string>>({});

  // Create form element
  const form = document.createElement('form');
  form.setAttribute('data-surface-ui-schema-form', '');
  form.setAttribute('data-concept', schema.concept);
  form.setAttribute('data-view-mode', viewMode);
  form.setAttribute('novalidate', ''); // We handle validation ourselves
  if (className) form.className = className;
  target.appendChild(form);

  // Track element renderer instances
  let fieldRenderers: Map<string, ElementRendererInstance> = new Map();
  let eventCleanups: Array<() => void> = [];

  function render(): void {
    // Clean up previous renderers
    for (const renderer of fieldRenderers.values()) renderer.destroy();
    fieldRenderers.clear();
    for (const cleanup of eventCleanups) cleanup();
    eventCleanups = [];
    form.innerHTML = '';

    const view = getView(schema, viewMode);
    if (!view) {
      const notice = document.createElement('p');
      notice.textContent = `No "${viewMode}" view defined for concept "${schema.concept}"`;
      notice.style.cssText = 'color: var(--color-warning, #ca8a04); font-style: italic;';
      form.appendChild(notice);
      return;
    }

    // Form title
    const title = document.createElement('h3');
    title.textContent = view.name;
    title.style.cssText = 'margin: 0 0 1em; font-size: 1.125em;';
    form.appendChild(title);

    // Fields container
    const fieldsContainer = document.createElement('div');
    fieldsContainer.setAttribute('data-form-fields', '');
    fieldsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 1em;';
    form.appendChild(fieldsContainer);

    // Render each field
    for (const field of view.fields) {
      const isReadOnly = viewMode === 'list' || viewMode === 'detail';
      const elementConfig = fieldToElementConfig(field);

      // For list/detail, convert input kinds to output kinds
      const effectiveConfig: ElementConfig = isReadOnly
        ? {
            ...elementConfig,
            kind: elementConfig.kind.startsWith('input-')
              ? elementConfig.kind.replace('input-', 'output-') as ElementConfig['kind']
              : elementConfig.kind,
          }
        : elementConfig;

      const fieldWrapper = document.createElement('div');
      fieldWrapper.setAttribute('data-field-name', field.name);
      fieldsContainer.appendChild(fieldWrapper);

      const renderer = createElementRenderer({
        target: fieldWrapper,
        props: {
          config: effectiveConfig,
          value: values$.get()[field.name],
          disabled: disabled || isReadOnly,
          'on:change': (event) => {
            const currentValues = { ...values$.get() };
            currentValues[event.id] = event.value;
            (values$ as WritableSignal<Record<string, unknown>>).set(currentValues);
            onChange?.({ field: event.id, value: event.value, values: currentValues });

            // Clear error on change
            const currentErrors = { ...errors$.get() };
            delete currentErrors[event.id];
            (errors$ as WritableSignal<Record<string, string>>).set(currentErrors);
          },
          'on:input': (event) => {
            const currentValues = { ...values$.get() };
            currentValues[event.id] = event.value;
            (values$ as WritableSignal<Record<string, unknown>>).set(currentValues);
          },
        },
      });

      fieldRenderers.set(field.name, renderer);

      // Error display
      const errorEl = document.createElement('div');
      errorEl.setAttribute('data-field-error', field.name);
      errorEl.setAttribute('role', 'alert');
      errorEl.style.cssText = 'color: var(--color-error, #dc2626); font-size: 0.8em; min-height: 1.2em; margin-top: 0.25em;';
      fieldWrapper.appendChild(errorEl);
    }

    // Submit button (only for create/edit modes)
    if (viewMode === 'create' || viewMode === 'edit') {
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5em; margin-top: 1em; justify-content: flex-end;';

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.textContent = viewMode === 'create' ? 'Create' : 'Save';
      submitButton.style.cssText = [
        'padding: 0.5em 1.5em',
        'border: none',
        'border-radius: 4px',
        'background: var(--color-primary, #2563eb)',
        'color: white',
        'font: inherit',
        'cursor: pointer',
      ].join('; ');
      if (disabled) submitButton.disabled = true;

      const resetButton = document.createElement('button');
      resetButton.type = 'reset';
      resetButton.textContent = 'Reset';
      resetButton.style.cssText = [
        'padding: 0.5em 1.5em',
        'border: 1px solid currentColor',
        'border-radius: 4px',
        'background: transparent',
        'color: inherit',
        'font: inherit',
        'cursor: pointer',
      ].join('; ');
      if (disabled) resetButton.disabled = true;

      actions.appendChild(resetButton);
      actions.appendChild(submitButton);
      form.appendChild(actions);
    }

    // Form submit handler
    const handleSubmit = (e: Event) => {
      e.preventDefault();
      const validationErrors = validateAll();
      if (Object.keys(validationErrors).length === 0) {
        onSubmit?.({ values: { ...values$.get() }, concept: schema.concept });
      }
    };

    const handleReset = (e: Event) => {
      e.preventDefault();
      (values$ as WritableSignal<Record<string, unknown>>).set({ ...initialValues });
      (errors$ as WritableSignal<Record<string, string>>).set({});
      // Re-apply values to renderers
      for (const [name, renderer] of fieldRenderers) {
        renderer.update({ value: initialValues[name] ?? '' });
      }
      updateErrorDisplays({});
    };

    form.addEventListener('submit', handleSubmit);
    form.addEventListener('reset', handleReset);
    eventCleanups.push(
      () => form.removeEventListener('submit', handleSubmit),
      () => form.removeEventListener('reset', handleReset),
    );
  }

  function validateAll(): Record<string, string> {
    const view = getView(schema, viewMode);
    if (!view) return {};

    const currentValues = values$.get();
    const newErrors: Record<string, string> = {};

    for (const field of view.fields) {
      const error = validateField(field, currentValues[field.name]);
      if (error) newErrors[field.name] = error;
    }

    (errors$ as WritableSignal<Record<string, string>>).set(newErrors);
    onValidate?.({ values: currentValues, errors: newErrors });
    updateErrorDisplays(newErrors);

    return newErrors;
  }

  function updateErrorDisplays(errors: Record<string, string>): void {
    for (const errorEl of form.querySelectorAll('[data-field-error]')) {
      const fieldName = errorEl.getAttribute('data-field-error');
      if (fieldName && errors[fieldName]) {
        (errorEl as HTMLElement).textContent = errors[fieldName];
      } else {
        (errorEl as HTMLElement).textContent = '';
      }
    }
  }

  // Subscribe to errors for reactive display
  const unsubErrors = errors$.subscribe((errors) => {
    updateErrorDisplays(errors);
  });

  // Initial render
  render();

  return {
    element: form,

    getValues(): Record<string, unknown> {
      return { ...values$.get() };
    },

    setValues(values: Record<string, unknown>): void {
      (values$ as WritableSignal<Record<string, unknown>>).set({ ...values });
      for (const [name, renderer] of fieldRenderers) {
        renderer.update({ value: values[name] });
      }
    },

    validate(): Record<string, string> {
      return validateAll();
    },

    reset(): void {
      (values$ as WritableSignal<Record<string, unknown>>).set({ ...initialValues });
      (errors$ as WritableSignal<Record<string, string>>).set({});
      for (const [name, renderer] of fieldRenderers) {
        renderer.update({ value: initialValues[name] ?? '' });
      }
    },

    update(newProps: Partial<UISchemaFormProps>): void {
      let needsRender = false;

      if (newProps.schema !== undefined) { schema = newProps.schema; needsRender = true; }
      if (newProps.viewMode !== undefined) {
        viewMode = newProps.viewMode;
        form.setAttribute('data-view-mode', viewMode);
        needsRender = true;
      }
      if (newProps.initialValues !== undefined) { initialValues = newProps.initialValues; }
      if (newProps.disabled !== undefined) { disabled = newProps.disabled; needsRender = true; }
      if (newProps['on:submit'] !== undefined) onSubmit = newProps['on:submit'];
      if (newProps['on:change'] !== undefined) onChange = newProps['on:change'];
      if (newProps['on:validate'] !== undefined) onValidate = newProps['on:validate'];
      if (newProps.className !== undefined) {
        className = newProps.className;
        form.className = className ?? '';
      }

      if (needsRender) render();
    },

    destroy(): void {
      unsubErrors();
      for (const cleanup of eventCleanups) cleanup();
      for (const renderer of fieldRenderers.values()) renderer.destroy();
      form.remove();
    },
  };
}
