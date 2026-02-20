// ============================================================
// UISchemaForm — Vanilla DOM Component
//
// Creates a <form> element with input fields generated from
// a COIF UISchema definition. Handles submit with
// preventDefault and collects form data into a typed object.
// Uses ElementRenderer internally for field creation.
// ============================================================

import type {
  UISchema,
  UISchemaView,
  UISchemaField,
  ElementKind,
  ElementConfig,
} from '../../shared/types.js';

import { mapElementToHTML } from '../../shared/coif-bridge.js';

// --- Public Interface ---

export interface UISchemaFormProps {
  /** COIF UISchema definition */
  schema: UISchema;
  /** Which view to render (defaults to 'create') */
  view?: 'list' | 'detail' | 'create' | 'edit';
  /** Initial form values */
  initialValues?: Record<string, unknown>;
  /** Callback on form submission with collected values */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Callback on individual field change */
  onFieldChange?: (fieldName: string, value: unknown) => void;
  /** Whether the form is in a loading/submitting state */
  loading?: boolean;
  /** Whether all fields are disabled */
  disabled?: boolean;
  /** Submit button label */
  submitLabel?: string;
  /** Optional CSS class name */
  className?: string;
}

export interface UISchemaFormOptions {
  target: HTMLElement;
  props: UISchemaFormProps;
}

// --- Component ---

export class UISchemaForm {
  private el: HTMLFormElement;
  private cleanup: (() => void)[] = [];
  private props: UISchemaFormProps;
  private fieldElements: Map<string, HTMLElement> = new Map();
  private formValues: Record<string, unknown> = {};

  constructor(options: UISchemaFormOptions) {
    const { target, props } = options;
    this.props = props;

    // Initialize form values from props
    this.formValues = { ...(props.initialValues ?? {}) };

    // Create form element
    this.el = document.createElement('form');
    this.el.setAttribute('data-coif-form', props.schema.concept);
    this.el.setAttribute('novalidate', '');

    if (props.className) {
      this.el.classList.add(props.className);
    }

    // Handle form submission
    const submitHandler = (e: Event) => {
      e.preventDefault();
      if (this.props.loading || this.props.disabled) return;

      // Validate before submit
      if (this.validate()) {
        this.props.onSubmit?.(this.getValues());
      }
    };
    this.el.addEventListener('submit', submitHandler);
    this.cleanup.push(() => this.el.removeEventListener('submit', submitHandler));

    // Render the selected view
    this.renderView();

    target.appendChild(this.el);
  }

  getElement(): HTMLFormElement {
    return this.el;
  }

  /** Get current form values */
  getValues(): Record<string, unknown> {
    return { ...this.formValues };
  }

  /** Set form values programmatically */
  setValues(values: Record<string, unknown>): void {
    this.formValues = { ...this.formValues, ...values };

    // Update DOM fields
    for (const [name, value] of Object.entries(values)) {
      const fieldEl = this.fieldElements.get(name);
      if (!fieldEl) continue;

      if (fieldEl instanceof HTMLInputElement) {
        if (fieldEl.type === 'checkbox') {
          fieldEl.checked = Boolean(value);
        } else {
          fieldEl.value = value != null ? String(value) : '';
        }
      } else if (fieldEl instanceof HTMLSelectElement) {
        fieldEl.value = value != null ? String(value) : '';
      }
    }
  }

  /** Validate all required fields; returns true if valid */
  validate(): boolean {
    let valid = true;

    const viewConfig = this.getActiveView();
    if (!viewConfig) return true;

    for (const field of viewConfig.fields) {
      const fieldEl = this.fieldElements.get(field.name);
      if (!fieldEl) continue;

      const value = this.formValues[field.name];
      const wrapper = fieldEl.closest('[data-field-wrapper]');

      // Clear previous error
      if (wrapper) {
        const errorEl = wrapper.querySelector('[data-field-error]');
        if (errorEl) errorEl.textContent = '';
        wrapper.removeAttribute('data-invalid');
      }

      // Required check
      if (field.required && (value === undefined || value === null || value === '')) {
        valid = false;
        if (wrapper) {
          wrapper.setAttribute('data-invalid', 'true');
          const errorEl = wrapper.querySelector('[data-field-error]');
          if (errorEl) errorEl.textContent = `${field.label} is required`;
        }
        fieldEl.setAttribute('aria-invalid', 'true');
      } else {
        fieldEl.removeAttribute('aria-invalid');
      }
    }

    return valid;
  }

  /** Reset form to initial values */
  reset(): void {
    this.formValues = { ...(this.props.initialValues ?? {}) };
    this.setValues(this.formValues);

    // Clear all validation errors
    const wrappers = this.el.querySelectorAll('[data-field-wrapper]');
    wrappers.forEach((w) => {
      w.removeAttribute('data-invalid');
      const errorEl = w.querySelector('[data-field-error]');
      if (errorEl) errorEl.textContent = '';
    });
  }

  update(props: Partial<UISchemaFormProps>): void {
    let needsRerender = false;

    if (props.schema !== undefined) {
      this.props.schema = props.schema;
      needsRerender = true;
    }

    if (props.view !== undefined) {
      this.props.view = props.view;
      needsRerender = true;
    }

    if (props.initialValues !== undefined) {
      this.props.initialValues = props.initialValues;
    }

    if (props.loading !== undefined) {
      this.props.loading = props.loading;
      this.el.setAttribute('data-loading', String(props.loading));
      // Disable submit button during loading
      const submitBtn = this.el.querySelector('[data-submit-btn]') as HTMLButtonElement | null;
      if (submitBtn) submitBtn.disabled = props.loading;
    }

    if (props.disabled !== undefined) {
      this.props.disabled = props.disabled;
      this.el.setAttribute('aria-disabled', String(props.disabled));
      // Disable all form fields
      const inputs = this.el.querySelectorAll('input, select, button, textarea');
      inputs.forEach((input) => {
        (input as HTMLInputElement).disabled = props.disabled!;
      });
    }

    if (props.submitLabel !== undefined) {
      this.props.submitLabel = props.submitLabel;
      const submitBtn = this.el.querySelector('[data-submit-btn]');
      if (submitBtn) submitBtn.textContent = props.submitLabel;
    }

    if (props.onSubmit !== undefined) {
      this.props.onSubmit = props.onSubmit;
    }

    if (props.onFieldChange !== undefined) {
      this.props.onFieldChange = props.onFieldChange;
    }

    if (props.className !== undefined) {
      this.el.className = '';
      if (props.className) {
        this.el.classList.add(props.className);
      }
    }

    if (needsRerender) {
      this.clearFields();
      this.renderView();
    }
  }

  destroy(): void {
    for (const fn of this.cleanup) {
      fn();
    }
    this.cleanup.length = 0;
    this.fieldElements.clear();

    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }

  // --- Private ---

  private getActiveView(): UISchemaView | undefined {
    const viewKey = this.props.view ?? 'create';
    return this.props.schema.views[viewKey];
  }

  private renderView(): void {
    const viewConfig = this.getActiveView();
    if (!viewConfig) {
      const msg = document.createElement('p');
      msg.textContent = `No "${this.props.view ?? 'create'}" view defined for concept "${this.props.schema.concept}".`;
      this.el.appendChild(msg);
      return;
    }

    this.el.setAttribute('data-view', viewConfig.name);

    // Render each field
    for (const field of viewConfig.fields) {
      const wrapper = this.createField(field);
      this.el.appendChild(wrapper);
    }

    // Add submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.setAttribute('data-submit-btn', '');
    submitBtn.textContent = this.props.submitLabel ?? 'Submit';
    if (this.props.loading) submitBtn.disabled = true;
    if (this.props.disabled) submitBtn.disabled = true;
    this.el.appendChild(submitBtn);
  }

  private createField(field: UISchemaField): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-field-wrapper', field.name);
    wrapper.style.marginBottom = '12px';

    // Label
    const label = document.createElement('label');
    label.textContent = field.label;
    label.setAttribute('for', `field-${field.name}`);
    if (field.required) {
      const req = document.createElement('span');
      req.textContent = ' *';
      req.setAttribute('aria-hidden', 'true');
      req.style.color = 'var(--color-error, #dc2626)';
      label.appendChild(req);
    }
    label.style.display = 'block';
    label.style.marginBottom = '4px';
    wrapper.appendChild(label);

    // Create the input element using the COIF element mapper
    const hint = mapElementToHTML(field.element);
    const input = document.createElement(hint.tag);
    input.id = `field-${field.name}`;
    input.setAttribute('name', field.name);

    // Set input type
    if (hint.inputType && input instanceof HTMLInputElement) {
      input.type = hint.inputType;
    }

    // Set role
    if (hint.role) {
      input.setAttribute('role', hint.role);
    }

    // Apply additional hint attributes
    for (const [attr, val] of Object.entries(hint.attributes)) {
      input.setAttribute(attr, val);
    }

    // ARIA
    input.setAttribute('aria-label', field.label);
    if (field.required) {
      input.setAttribute('aria-required', 'true');
      if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
        input.required = true;
      }
    }

    // Disabled state
    if (this.props.disabled) {
      if (input instanceof HTMLInputElement ||
          input instanceof HTMLSelectElement ||
          input instanceof HTMLButtonElement) {
        (input as HTMLInputElement).disabled = true;
      }
    }

    // Apply constraints
    if (field.constraints && input instanceof HTMLInputElement) {
      for (const [key, value] of Object.entries(field.constraints)) {
        switch (key) {
          case 'min': input.min = String(value); break;
          case 'max': input.max = String(value); break;
          case 'minLength': input.minLength = Number(value); break;
          case 'maxLength': input.maxLength = Number(value); break;
          case 'pattern': input.pattern = String(value); break;
          case 'step': input.step = String(value); break;
          case 'placeholder': input.placeholder = String(value); break;
          case 'options':
            // For selection elements, populate options
            if (input instanceof HTMLSelectElement && Array.isArray(value)) {
              for (const opt of value as Array<{ value: string; label: string }>) {
                const optEl = document.createElement('option');
                optEl.value = opt.value;
                optEl.textContent = opt.label;
                input.appendChild(optEl);
              }
            }
            break;
        }
      }
    }

    // Handle selection-type elements with options
    if (
      (field.element === 'selection-single' || field.element === 'selection-multi') &&
      input instanceof HTMLSelectElement &&
      field.constraints?.['options']
    ) {
      const options = field.constraints['options'] as Array<{ value: string; label: string }>;
      for (const opt of options) {
        const optEl = document.createElement('option');
        optEl.value = opt.value;
        optEl.textContent = opt.label;
        input.appendChild(optEl);
      }
    }

    // Set initial value
    const initialValue = this.formValues[field.name];
    if (initialValue !== undefined && initialValue !== null) {
      if (field.element === 'input-bool' && input instanceof HTMLInputElement) {
        input.checked = Boolean(initialValue);
      } else if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
        input.value = String(initialValue);
      }
    }

    // Bind change event
    const changeHandler = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLSelectElement;
      let value: unknown;

      if (field.element === 'input-bool' && target instanceof HTMLInputElement) {
        value = target.checked;
      } else if (field.element === 'input-number' && target instanceof HTMLInputElement) {
        value = target.valueAsNumber;
      } else if (field.element === 'input-date' && target instanceof HTMLInputElement) {
        value = target.value; // Keep as string for serialization
      } else if (field.element === 'selection-multi' && target instanceof HTMLSelectElement) {
        value = Array.from(target.selectedOptions).map((o) => o.value);
      } else {
        value = (target as HTMLInputElement).value;
      }

      this.formValues[field.name] = value;
      this.props.onFieldChange?.(field.name, value);

      // Clear error on change
      wrapper.removeAttribute('data-invalid');
      const errorEl = wrapper.querySelector('[data-field-error]');
      if (errorEl) errorEl.textContent = '';
      input.removeAttribute('aria-invalid');
    };

    const eventType = field.element.startsWith('selection-') ? 'change' : 'input';
    input.addEventListener(eventType, changeHandler);
    this.cleanup.push(() => input.removeEventListener(eventType, changeHandler));

    this.fieldElements.set(field.name, input);
    wrapper.appendChild(input);

    // Error message placeholder
    const errorEl = document.createElement('div');
    errorEl.setAttribute('data-field-error', '');
    errorEl.setAttribute('role', 'alert');
    errorEl.style.color = 'var(--color-error, #dc2626)';
    errorEl.style.fontSize = '12px';
    errorEl.style.marginTop = '2px';
    wrapper.appendChild(errorEl);

    return wrapper;
  }

  private clearFields(): void {
    // Remove all child elements from the form
    while (this.el.firstChild) {
      this.el.removeChild(this.el.firstChild);
    }
    this.fieldElements.clear();
  }
}
