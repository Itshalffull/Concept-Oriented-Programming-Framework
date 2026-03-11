// ============================================================
// MultiSelect — Vanilla DOM Widget
//
// Dropdown multi-select with chip display and keyboard navigation.
// ============================================================

export interface MultiSelectProps {
  values?: string[];
  defaultValues?: string[];
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
  label: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  maxSelections?: number;
  onChange?: (values: string[]) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface MultiSelectOptions { target: HTMLElement; props: MultiSelectProps; }

let _multiSelectUid = 0;

export class MultiSelect {
  private el: HTMLElement;
  private props: MultiSelectProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MultiSelectOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `multi-select-${++_multiSelectUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'multi-select');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MultiSelectProps>): void {
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
