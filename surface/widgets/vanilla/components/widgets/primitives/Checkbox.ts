// ============================================================
// Checkbox — Vanilla DOM Widget
//
// Toggle checkbox with checked/unchecked/indeterminate states.
// Hidden native input for form submission, visual control span.
// ============================================================

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  required?: boolean;
  value?: string;
  name?: string;
  label?: string;
  onChange?: (checked: boolean) => void;
  className?: string;
}

export interface CheckboxOptions {
  target: HTMLElement;
  props: CheckboxProps;
}

let checkboxUid = 0;

export class Checkbox {
  private el: HTMLElement;
  private props: CheckboxProps;
  private inputEl: HTMLInputElement;
  private controlEl: HTMLElement;
  private indicatorEl: HTMLElement;
  private labelEl: HTMLLabelElement | null = null;
  private focused = false;
  private uid: string;

  constructor(options: CheckboxOptions) {
    const { target, props } = options;
    this.props = {
      checked: false, indeterminate: false, disabled: false,
      required: false, value: '', ...props,
    };
    this.uid = `checkbox-${++checkboxUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'checkbox');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    // Hidden input
    this.inputEl = document.createElement('input');
    this.inputEl.type = 'checkbox';
    this.inputEl.setAttribute('role', 'checkbox');
    this.inputEl.setAttribute('data-part', 'input');
    this.inputEl.id = this.props.name || this.uid;
    Object.assign(this.inputEl.style, {
      position: 'absolute', opacity: '0', width: '0', height: '0', margin: '0',
    });
    this.el.appendChild(this.inputEl);

    // Control
    this.controlEl = document.createElement('span');
    this.controlEl.setAttribute('data-part', 'control');
    this.controlEl.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.controlEl);

    // Indicator
    this.indicatorEl = document.createElement('span');
    this.indicatorEl.setAttribute('data-part', 'indicator');
    this.indicatorEl.setAttribute('aria-hidden', 'true');
    this.controlEl.appendChild(this.indicatorEl);

    // Label
    if (this.props.label) {
      this.labelEl = document.createElement('label');
      this.labelEl.setAttribute('data-part', 'label');
      this.labelEl.htmlFor = this.inputEl.id;
      this.labelEl.textContent = this.props.label;
      this.el.appendChild(this.labelEl);
    }

    this.syncState();

    this.el.addEventListener('click', () => this.handleToggle());
    this.inputEl.addEventListener('change', () => this.handleToggle());
    this.inputEl.addEventListener('focus', () => { this.focused = true; this.syncState(); });
    this.inputEl.addEventListener('blur', () => { this.focused = false; this.syncState(); });

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<CheckboxProps>): void {
    Object.assign(this.props, props);
    if (props.label !== undefined && this.labelEl) {
      this.labelEl.textContent = props.label || '';
    }
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private handleToggle(): void {
    if (this.props.disabled) return;
    this.props.checked = !this.props.checked;
    this.props.onChange?.(this.props.checked);
    this.syncState();
  }

  private syncState(): void {
    const { checked, indeterminate, disabled, required, value, name } = this.props;
    const isChecked = !!checked;
    const dataState = indeterminate ? 'indeterminate' : isChecked ? 'checked' : 'unchecked';
    const ariaChecked = indeterminate ? 'mixed' : isChecked ? 'true' : 'false';

    this.el.setAttribute('data-state', dataState);
    this.el.setAttribute('data-disabled', disabled ? 'true' : 'false');

    this.inputEl.checked = isChecked;
    this.inputEl.disabled = !!disabled;
    this.inputEl.required = !!required;
    this.inputEl.indeterminate = !!indeterminate;
    if (value !== undefined) this.inputEl.value = value;
    if (name) this.inputEl.name = name;
    this.inputEl.setAttribute('aria-checked', ariaChecked);
    this.inputEl.setAttribute('aria-required', required ? 'true' : 'false');
    this.inputEl.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    this.inputEl.tabIndex = disabled ? -1 : 0;
    if (this.labelEl) {
      this.inputEl.setAttribute('aria-labelledby', this.labelEl.id || '');
      this.labelEl.setAttribute('data-disabled', disabled ? 'true' : 'false');
    }

    this.controlEl.setAttribute('data-state', dataState);
    this.controlEl.setAttribute('data-disabled', disabled ? 'true' : 'false');
    this.controlEl.setAttribute('data-focused', this.focused ? 'true' : 'false');

    this.indicatorEl.setAttribute('data-state', dataState);
    this.indicatorEl.setAttribute('data-visible', (isChecked || !!indeterminate) ? 'true' : 'false');
  }
}
