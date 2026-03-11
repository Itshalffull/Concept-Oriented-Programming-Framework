// ============================================================
// TextInput — Vanilla DOM Widget
//
// Single-line text input with label, prefix/suffix, description,
// error, and clear button support.
// ============================================================

export interface TextInputProps {
  value?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  maxLength?: number;
  pattern?: string;
  name?: string;
  autocomplete?: string;
  label?: string;
  description?: string;
  error?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export interface TextInputOptions {
  target: HTMLElement;
  props: TextInputProps;
}

let textInputUid = 0;

export class TextInput {
  private el: HTMLElement;
  private props: TextInputProps;
  private inputEl: HTMLInputElement;
  private labelEl: HTMLLabelElement | null = null;
  private descriptionEl: HTMLElement | null = null;
  private errorEl: HTMLElement | null = null;
  private clearBtn: HTMLButtonElement | null = null;
  private focused = false;
  private uid: string;

  constructor(options: TextInputOptions) {
    const { target, props } = options;
    this.props = {
      value: '', placeholder: '', required: false, disabled: false,
      readOnly: false, ...props,
    };
    this.uid = `text-input-${++textInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'text-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    // Label
    if (this.props.label) {
      this.labelEl = document.createElement('label');
      this.labelEl.id = `${this.uid}-label`;
      this.labelEl.htmlFor = this.props.name || this.uid;
      this.labelEl.setAttribute('data-part', 'label');
      this.labelEl.setAttribute('data-required', this.props.required ? 'true' : 'false');
      this.labelEl.textContent = this.props.label;
      this.el.appendChild(this.labelEl);
    }

    // Input
    this.inputEl = document.createElement('input');
    this.inputEl.id = this.props.name || this.uid;
    this.inputEl.type = 'text';
    this.inputEl.setAttribute('role', 'textbox');
    this.inputEl.setAttribute('data-part', 'input');
    this.el.appendChild(this.inputEl);

    // Clear button
    this.clearBtn = document.createElement('button');
    this.clearBtn.type = 'button';
    this.clearBtn.setAttribute('data-part', 'clear-button');
    this.clearBtn.setAttribute('role', 'button');
    this.clearBtn.setAttribute('aria-label', 'Clear input');
    this.clearBtn.tabIndex = -1;
    this.clearBtn.addEventListener('click', () => this.handleClear());
    this.el.appendChild(this.clearBtn);

    // Description
    if (this.props.description) {
      this.descriptionEl = document.createElement('span');
      this.descriptionEl.id = `${this.uid}-description`;
      this.descriptionEl.setAttribute('data-part', 'description');
      this.descriptionEl.textContent = this.props.description;
      this.el.appendChild(this.descriptionEl);
    }

    // Error
    if (this.props.error) {
      this.errorEl = document.createElement('span');
      this.errorEl.id = `${this.uid}-error`;
      this.errorEl.setAttribute('data-part', 'error');
      this.errorEl.setAttribute('role', 'alert');
      this.errorEl.setAttribute('aria-live', 'polite');
      this.errorEl.textContent = this.props.error;
      this.el.appendChild(this.errorEl);
    }

    // Events
    this.inputEl.addEventListener('input', () => {
      this.props.value = this.inputEl.value;
      this.props.onChange?.(this.inputEl.value);
      this.syncState();
    });
    this.inputEl.addEventListener('focus', () => { this.focused = true; this.syncState(); });
    this.inputEl.addEventListener('blur', () => { this.focused = false; this.syncState(); });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.handleClear();
    });

    this.syncState();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<TextInputProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    if (props.label !== undefined && this.labelEl) this.labelEl.textContent = props.label || '';
    if (props.description !== undefined && this.descriptionEl) {
      this.descriptionEl.textContent = props.description || '';
    }
    if (props.error !== undefined) {
      if (this.errorEl) {
        this.errorEl.textContent = props.error || '';
        this.errorEl.setAttribute('data-visible', props.error ? 'true' : 'false');
      }
    }
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private handleClear(): void {
    this.props.value = '';
    this.inputEl.value = '';
    this.props.onChange?.('');
    this.props.onClear?.();
    this.syncState();
  }

  private syncState(): void {
    const { value, placeholder, disabled, readOnly, required, maxLength, pattern, name, autocomplete, error } = this.props;
    const isInvalid = !!error;
    const isFilled = !!(value && value.length > 0);

    this.inputEl.value = value || '';
    this.inputEl.placeholder = placeholder || '';
    this.inputEl.disabled = !!disabled;
    this.inputEl.readOnly = !!readOnly;
    this.inputEl.required = !!required;
    if (maxLength !== undefined) this.inputEl.maxLength = maxLength;
    if (pattern) this.inputEl.pattern = pattern;
    if (name) this.inputEl.name = name;
    if (autocomplete) this.inputEl.autocomplete = autocomplete;

    this.inputEl.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
    this.inputEl.setAttribute('aria-required', required ? 'true' : 'false');
    this.inputEl.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    this.inputEl.setAttribute('aria-readonly', readOnly ? 'true' : 'false');
    if (this.labelEl) this.inputEl.setAttribute('aria-labelledby', this.labelEl.id);
    if (isInvalid && this.errorEl) {
      this.inputEl.setAttribute('aria-describedby', this.errorEl.id);
    } else if (this.descriptionEl) {
      this.inputEl.setAttribute('aria-describedby', this.descriptionEl.id);
    } else {
      this.inputEl.removeAttribute('aria-describedby');
    }

    const rootDataState = disabled ? 'disabled' : readOnly ? 'readonly' : 'default';
    this.el.setAttribute('data-state', rootDataState);
    this.el.setAttribute('data-focus', this.focused ? 'true' : 'false');
    this.el.setAttribute('data-invalid', isInvalid ? 'true' : 'false');

    if (this.clearBtn) {
      const showClear = isFilled && !disabled && !readOnly;
      this.clearBtn.style.display = showClear ? '' : 'none';
      this.clearBtn.setAttribute('data-visible', showClear ? 'true' : 'false');
    }
  }
}
