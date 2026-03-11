// ============================================================
// ComboboxMulti — Vanilla DOM Widget
//
// Multi-select combobox with chip display and filtering.
// ============================================================

export interface ComboboxMultiProps {
  values?: string[];
  defaultValues?: string[];
  inputValue?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  maxSelections?: number;
  onChange?: (values: string[]) => void;
  onInputChange?: (inputValue: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ComboboxMultiOptions { target: HTMLElement; props: ComboboxMultiProps; }

let _comboboxMultiUid = 0;

export class ComboboxMulti {
  private el: HTMLElement;
  private props: ComboboxMultiProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ComboboxMultiOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `combobox-multi-${++_comboboxMultiUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'combobox-multi');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ComboboxMultiProps>): void {
    Object.assign(this.props, props);
    if (props.className !== undefined) this.el.className = props.className || '';
    this.el.innerHTML = '';
    this.render();
  }

  destroy(): void { if (this.el.parentNode) this.el.parentNode.removeChild(this.el); }

  private render(): void {
    this.syncState();
  }

  private syncState(): void {
    this.el.setAttribute('data-state', this.state);
  }
}
