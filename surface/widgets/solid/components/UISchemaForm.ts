// ============================================================
// UISchemaForm — Solid.js Component
//
// Auto-generated form from UISchema. Takes a Clef Surface UISchema
// definition and renders a complete form with fields mapped
// through ElementRenderer. Manages form-level state, validation,
// and submission reactively.
// ============================================================

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
  ElementConfig,
} from '../../shared/types.js';

import { createSignal as surfaceCreateSignal } from '../../shared/surface-bridge.js';
import { ElementRenderer } from './ElementRenderer.js';

// --- Solid-style reactive primitives ---

function solidCreateSignal<T>(initial: T): [() => T, (v: T) => void] {
  const sig = surfaceCreateSignal<T>(initial);
  return [() => sig.get(), (v: T) => sig.set(v)];
}

function solidCreateMemo<T>(deps: Array<() => unknown>, compute: () => T): () => T {
  let cached = compute();
  let lastValues = deps.map(d => d());

  return () => {
    const currentValues = deps.map(d => d());
    const changed = currentValues.some((v, i) => v !== lastValues[i]);
    if (changed) {
      lastValues = currentValues;
      cached = compute();
    }
    return cached;
  };
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

// --- Helper: convert UISchemaField to ElementConfig ---

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

// --- Component Props ---

export type FormViewMode = 'list' | 'detail' | 'create' | 'edit';

export interface UISchemaFormProps {
  schema: UISchema;
  viewMode?: FormViewMode;
  initialValues?: Record<string, unknown>;
  disabled?: boolean;
  class?: string;
  onSubmit?: (values: Record<string, unknown>) => void;
  onChange?: (field: string, value: unknown) => void;
  onValidationError?: (errors: Record<string, string>) => void;
}

// --- Component Result ---

export interface UISchemaFormResult {
  element: HTMLFormElement;
  dispose: () => void;
  getValues: () => Record<string, unknown>;
  setValues: (values: Record<string, unknown>) => void;
  validate: () => Record<string, string>;
  reset: () => void;
  setViewMode: (mode: FormViewMode) => void;
  isValid: () => boolean;
}

// --- Component ---

export function UISchemaForm(props: UISchemaFormProps): UISchemaFormResult {
  const [viewMode, setViewMode] = solidCreateSignal<FormViewMode>(props.viewMode ?? 'edit');
  const [values, setValues] = solidCreateSignal<Record<string, unknown>>(
    props.initialValues ?? {}
  );
  const [errors, setErrors] = solidCreateSignal<Record<string, string>>({});
  const [submitted, setSubmitted] = solidCreateSignal<boolean>(false);

  // createMemo: derive the active view from the schema based on viewMode
  const activeView = solidCreateMemo([viewMode], (): UISchemaView | null => {
    const mode = viewMode();
    const views = props.schema.views;

    switch (mode) {
      case 'list': return views.list ?? null;
      case 'detail': return views.detail ?? null;
      case 'create': return views.create ?? null;
      case 'edit': return views.edit ?? null;
      default: return null;
    }
  });

  // createMemo: determine if form is read-only based on view mode
  const isReadOnly = solidCreateMemo([viewMode], (): boolean => {
    const mode = viewMode();
    return mode === 'list' || mode === 'detail';
  });

  // Validation
  function validate(): Record<string, string> {
    const view = activeView();
    if (!view) return {};

    const fieldErrors: Record<string, string> = {};
    const currentValues = values();

    for (const field of view.fields) {
      const value = currentValues[field.name];

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        fieldErrors[field.name] = `${field.label} is required`;
        continue;
      }

      // Constraint checks
      if (field.constraints && value !== undefined && value !== null) {
        if (field.constraints.minLength !== undefined) {
          if (typeof value === 'string' && value.length < (field.constraints.minLength as number)) {
            fieldErrors[field.name] = `${field.label} must be at least ${field.constraints.minLength} characters`;
          }
        }
        if (field.constraints.maxLength !== undefined) {
          if (typeof value === 'string' && value.length > (field.constraints.maxLength as number)) {
            fieldErrors[field.name] = `${field.label} must be at most ${field.constraints.maxLength} characters`;
          }
        }
        if (field.constraints.min !== undefined) {
          if (typeof value === 'number' && value < (field.constraints.min as number)) {
            fieldErrors[field.name] = `${field.label} must be at least ${field.constraints.min}`;
          }
        }
        if (field.constraints.max !== undefined) {
          if (typeof value === 'number' && value > (field.constraints.max as number)) {
            fieldErrors[field.name] = `${field.label} must be at most ${field.constraints.max}`;
          }
        }
        if (field.constraints.pattern !== undefined) {
          if (typeof value === 'string') {
            const regex = new RegExp(field.constraints.pattern as string);
            if (!regex.test(value)) {
              fieldErrors[field.name] = `${field.label} format is invalid`;
            }
          }
        }
      }
    }

    setErrors(fieldErrors);
    return fieldErrors;
  }

  const isValid = solidCreateMemo([errors], (): boolean => {
    return Object.keys(errors()).length === 0;
  });

  // Create the form element
  const form = document.createElement('form');
  form.setAttribute('data-surface-widget', 'ui-schema-form');
  form.setAttribute('data-concept', props.schema.concept);
  form.setAttribute('novalidate', '');

  if (props.class) {
    form.setAttribute('class', props.class);
  }

  // Track field renderers for cleanup
  const fieldDisposers: Array<() => void> = [];

  // Reactive effect: rebuild form fields when view mode changes
  const disposeRebuild = solidCreateEffect([viewMode], () => {
    // Clean up previous field renderers
    for (const d of fieldDisposers) d();
    fieldDisposers.length = 0;

    // Clear form contents
    while (form.firstChild) {
      form.removeChild(form.firstChild);
    }

    const view = activeView();
    if (!view) {
      const empty = document.createElement('p');
      empty.textContent = `No view defined for mode: ${viewMode()}`;
      form.appendChild(empty);
      return;
    }

    // Form header
    const header = document.createElement('div');
    header.setAttribute('class', 'surface-form__header');

    const title = document.createElement('h2');
    title.textContent = `${props.schema.concept} — ${view.name}`;
    header.appendChild(title);
    form.appendChild(header);

    // Field container
    const fieldContainer = document.createElement('div');
    fieldContainer.setAttribute('class', 'surface-form__fields');
    fieldContainer.style.setProperty('display', 'flex');
    fieldContainer.style.setProperty('flex-direction', 'column');
    fieldContainer.style.setProperty('gap', '12px');

    // Render each field
    for (const field of view.fields) {
      const config = fieldToElementConfig(field);
      const currentValue = values()[field.name];

      const fieldResult = ElementRenderer({
        config,
        value: currentValue,
        disabled: props.disabled || isReadOnly(),
        onChange: (newValue: unknown) => {
          const current = values();
          setValues({ ...current, [field.name]: newValue });

          if (props.onChange) {
            props.onChange(field.name, newValue);
          }

          // Re-validate if already submitted
          if (submitted()) {
            validate();
          }
        },
      });

      fieldContainer.appendChild(fieldResult.element);
      fieldDisposers.push(fieldResult.dispose);
    }

    form.appendChild(fieldContainer);

    // Error display area
    const errorArea = document.createElement('div');
    errorArea.setAttribute('class', 'surface-form__errors');
    errorArea.setAttribute('role', 'alert');
    errorArea.setAttribute('aria-live', 'polite');
    form.appendChild(errorArea);

    // Update error display reactively
    const disposeErrors = solidCreateEffect([errors], () => {
      const currentErrors = errors();
      const errorKeys = Object.keys(currentErrors);

      while (errorArea.firstChild) {
        errorArea.removeChild(errorArea.firstChild);
      }

      if (errorKeys.length > 0) {
        const errorList = document.createElement('ul');
        errorList.style.setProperty('color', 'var(--surface-error, #dc2626)');
        errorList.style.setProperty('list-style', 'none');
        errorList.style.setProperty('padding', '0');
        errorList.style.setProperty('margin', '8px 0');

        for (const key of errorKeys) {
          const li = document.createElement('li');
          li.textContent = currentErrors[key];
          errorList.appendChild(li);
        }

        errorArea.appendChild(errorList);

        if (props.onValidationError) {
          props.onValidationError(currentErrors);
        }
      }
    });
    fieldDisposers.push(disposeErrors);

    // Submit button (only for create/edit modes)
    if (!isReadOnly()) {
      const actions = document.createElement('div');
      actions.setAttribute('class', 'surface-form__actions');
      actions.style.setProperty('display', 'flex');
      actions.style.setProperty('gap', '8px');
      actions.style.setProperty('margin-top', '16px');

      const submitBtn = document.createElement('button');
      submitBtn.setAttribute('type', 'submit');
      submitBtn.textContent = viewMode() === 'create' ? 'Create' : 'Save';

      const resetBtn = document.createElement('button');
      resetBtn.setAttribute('type', 'button');
      resetBtn.textContent = 'Reset';
      resetBtn.addEventListener('click', () => {
        reset();
      });

      actions.appendChild(submitBtn);
      actions.appendChild(resetBtn);
      form.appendChild(actions);
    }
  });

  // Form submission handler — native DOM event
  form.addEventListener('submit', (e: Event) => {
    e.preventDefault();
    setSubmitted(true);

    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length === 0) {
      if (props.onSubmit) {
        props.onSubmit(values());
      }

      form.dispatchEvent(
        new CustomEvent('surface:form-submit', {
          bubbles: true,
          detail: {
            concept: props.schema.concept,
            viewMode: viewMode(),
            values: values(),
          },
        })
      );
    }
  });

  function reset() {
    setValues(props.initialValues ?? {});
    setErrors({});
    setSubmitted(false);
  }

  function dispose() {
    disposeRebuild();
    for (const d of fieldDisposers) d();
    form.remove();
  }

  return {
    element: form,
    dispose,
    getValues: values,
    setValues: (vals: Record<string, unknown>) => setValues(vals),
    validate,
    reset,
    setViewMode,
    isValid,
  };
}
