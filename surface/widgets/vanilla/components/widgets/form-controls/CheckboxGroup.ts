// ============================================================
// CheckboxGroup — Vanilla DOM Widget
//
// Group of checkboxes with min/max selection constraints.
// ============================================================

export interface OptionItem { value: string; label: string; disabled?: boolean; }

export interface CheckboxGroupProps {
  values?: string[];
  defaultValues?: string[];
  options: OptionItem[];
  orientation?: 'horizontal' | 'vertical';
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  min?: number;
  max?: number;
  onChange?: (values: string[]) => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface CheckboxGroupOptions { target: HTMLElement; props: CheckboxGroupProps; }

let _cbgUid = 0;

export class CheckboxGroup {
  private el: HTMLElement;
  private props: CheckboxGroupProps;
  private values: string[];
  private itemsEl: HTMLElement;
  private uid: string;

  constructor(options: CheckboxGroupOptions) {
    const { target, props } = options;
    this.uid = `cbg-${++_cbgUid}`;
    this.props = { orientation: 'vertical', disabled: false, required: false, size: 'md', ...props };
    this.values = [...(props.values ?? props.defaultValues ?? [])];

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'group');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'checkbox-group');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('aria-label', this.props.label);
    if (this.props.className) this.el.className = this.props.className;

    const labelEl = document.createElement('span');
    labelEl.setAttribute('data-part', 'label');
    labelEl.id = `${this.uid}-label`;
    labelEl.textContent = this.props.label;
    this.el.appendChild(labelEl);

    this.itemsEl = document.createElement('div');
    this.itemsEl.setAttribute('data-part', 'items');
    this.itemsEl.setAttribute('aria-labelledby', labelEl.id);
    this.el.appendChild(this.itemsEl);

    this.renderItems();
    this.syncRoot();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<CheckboxGroupProps>): void {
    if (props.values !== undefined) this.values = [...props.values];
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.itemsEl.innerHTML = '';
    this.renderItems();
    this.syncRoot();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private renderItems(): void {
    for (const option of this.props.options) {
      const isChecked = this.values.includes(option.value);
      const isDisabled = option.disabled || this.props.disabled;
      const label = document.createElement('label');
      label.setAttribute('data-part', 'item');
      label.setAttribute('data-state', isChecked ? 'checked' : 'unchecked');
      label.setAttribute('data-disabled', isDisabled ? 'true' : 'false');

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-part', 'itemInput');
      input.name = `${this.props.name || this.uid}[]`;
      input.value = option.value;
      input.checked = isChecked;
      input.disabled = !!isDisabled;
      input.setAttribute('role', 'checkbox');
      input.setAttribute('aria-checked', isChecked ? 'true' : 'false');
      input.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
      input.setAttribute('aria-label', option.label);
      Object.assign(input.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' });
      input.addEventListener('change', () => this.handleToggle(option.value));
      label.appendChild(input);

      const control = document.createElement('span');
      control.setAttribute('data-part', 'itemControl');
      control.setAttribute('aria-hidden', 'true');
      label.appendChild(control);

      const text = document.createElement('span');
      text.setAttribute('data-part', 'itemLabel');
      text.textContent = option.label;
      label.appendChild(text);

      this.itemsEl.appendChild(label);
    }
  }

  private handleToggle(value: string): void {
    if (this.props.disabled) return;
    const idx = this.values.indexOf(value);
    if (idx >= 0) {
      if (this.props.min !== undefined && this.values.length <= this.props.min) return;
      this.values.splice(idx, 1);
    } else {
      if (this.props.max !== undefined && this.values.length >= this.props.max) return;
      this.values.push(value);
    }
    this.props.onChange?.([...this.values]);
    this.itemsEl.innerHTML = '';
    this.renderItems();
  }

  private syncRoot(): void {
    this.el.setAttribute('data-orientation', this.props.orientation!);
    this.el.setAttribute('data-disabled', this.props.disabled ? 'true' : 'false');
    this.el.setAttribute('data-size', this.props.size!);
    this.el.setAttribute('aria-orientation', this.props.orientation!);
    this.el.setAttribute('aria-required', this.props.required ? 'true' : 'false');
    this.itemsEl.setAttribute('data-orientation', this.props.orientation!);
  }
}
