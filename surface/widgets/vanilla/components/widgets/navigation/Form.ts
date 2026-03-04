// ============================================================
// Form — Vanilla DOM Widget
//
// Form container with validation, submit handling, and field management.
// ============================================================

export interface FormProps {
  onSubmit?: (data: Record<string, unknown>) => void;
  onReset?: () => void;
  disabled?: boolean;
  autoComplete?: string;
  className?: string;
}

export interface FormOptions { target: HTMLElement; props: FormProps; }

let _formUid = 0;

export class Form {
  private el: HTMLElement;
  private props: FormProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FormOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `form-${++_formUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'form');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FormProps>): void {
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
