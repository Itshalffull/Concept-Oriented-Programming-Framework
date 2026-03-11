// ============================================================
// Select — Vanilla DOM Widget
//
// Custom dropdown select with listbox and keyboard navigation.
// ============================================================

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface SelectOptions { target: HTMLElement; props: SelectProps; }

let _selectUid = 0;

export class Select {
  private el: HTMLElement;
  private props: SelectProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SelectOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `select-${++_selectUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'select');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SelectProps>): void {
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
