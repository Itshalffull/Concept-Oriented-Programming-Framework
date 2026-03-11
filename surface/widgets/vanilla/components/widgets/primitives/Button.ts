// ============================================================
// Button — Vanilla DOM Widget
//
// Interactive button with variant, size, loading, and disabled
// states. Tracks hover/focus/press interaction states.
// ============================================================

export interface ButtonProps {
  variant?: 'filled' | 'outline' | 'text' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  iconPosition?: 'start' | 'end';
  onClick?: () => void;
  label?: string;
  className?: string;
}

export interface ButtonOptions {
  target: HTMLElement;
  props: ButtonProps;
}

export class Button {
  private el: HTMLButtonElement;
  private props: ButtonProps;
  private state: string = 'idle';
  private spinnerEl: HTMLElement;
  private iconEl: HTMLElement;
  private labelEl: HTMLElement;

  constructor(options: ButtonOptions) {
    const { target, props } = options;
    this.props = {
      variant: 'filled', size: 'md', disabled: false, loading: false,
      type: 'button', iconPosition: 'start', ...props,
    };

    this.el = document.createElement('button');
    this.el.type = this.props.type!;
    this.el.setAttribute('role', 'button');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'button');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    // Spinner
    this.spinnerEl = document.createElement('span');
    this.spinnerEl.setAttribute('data-part', 'spinner');
    this.el.appendChild(this.spinnerEl);

    // Icon
    this.iconEl = document.createElement('span');
    this.iconEl.setAttribute('data-part', 'icon');
    this.iconEl.setAttribute('aria-hidden', 'true');
    this.el.appendChild(this.iconEl);

    // Label
    this.labelEl = document.createElement('span');
    this.labelEl.setAttribute('data-part', 'label');
    this.labelEl.textContent = this.props.label || '';
    this.el.appendChild(this.labelEl);

    this.syncState();

    this.el.addEventListener('click', () => {
      if (!this.props.disabled && !this.props.loading) this.props.onClick?.();
    });
    this.el.addEventListener('mouseenter', () => { this.state = 'hovered'; this.syncDataState(); });
    this.el.addEventListener('mouseleave', () => { this.state = 'idle'; this.syncDataState(); });
    this.el.addEventListener('focus', () => { this.state = 'focused'; this.syncDataState(); });
    this.el.addEventListener('blur', () => { this.state = 'idle'; this.syncDataState(); });
    this.el.addEventListener('pointerdown', () => { this.state = 'pressed'; this.syncDataState(); });
    this.el.addEventListener('pointerup', () => { this.state = 'idle'; this.syncDataState(); });

    target.appendChild(this.el);
  }

  getElement(): HTMLElement {
    return this.el;
  }

  update(props: Partial<ButtonProps>): void {
    Object.assign(this.props, props);
    if (props.label !== undefined) this.labelEl.textContent = props.label;
    if (props.className !== undefined) this.el.className = props.className || '';
    if (props.type !== undefined) this.el.type = props.type;
    this.syncState();
  }

  destroy(): void {
    if (this.el.parentNode) this.el.parentNode.removeChild(this.el);
  }

  private syncState(): void {
    const { variant, size, disabled, loading, iconPosition } = this.props;
    this.el.disabled = !!(disabled || loading);
    this.el.setAttribute('aria-disabled', String(!!(disabled || loading)));
    this.el.setAttribute('aria-busy', String(!!loading));
    this.el.tabIndex = disabled ? -1 : 0;
    this.el.setAttribute('data-variant', variant!);
    this.el.setAttribute('data-size', size!);
    this.iconEl.setAttribute('data-position', iconPosition!);
    this.labelEl.setAttribute('data-size', size!);
    this.spinnerEl.setAttribute('aria-hidden', String(!loading));
    this.spinnerEl.setAttribute('data-visible', String(!!loading));
    this.syncDataState();
  }

  private syncDataState(): void {
    const dataState = this.props.loading ? 'loading' : this.props.disabled ? 'disabled' : this.state;
    this.el.setAttribute('data-state', dataState);
  }
}
