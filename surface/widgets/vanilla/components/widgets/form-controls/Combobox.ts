// ============================================================
// Combobox — Vanilla DOM Widget
//
// Searchable select with option filtering and keyboard navigation.
// ============================================================

export interface ComboboxProps {
  value?: string;
  defaultValue?: string;
  inputValue?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  allowCustom?: boolean;
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  onChange?: (value: string) => void;
  onInputChange?: (inputValue: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ComboboxOptions { target: HTMLElement; props: ComboboxProps; }

let _comboboxUid = 0;

export class Combobox {
  private el: HTMLElement;
  private props: ComboboxProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ComboboxOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `combobox-${++_comboboxUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'combobox');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ComboboxProps>): void {
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
