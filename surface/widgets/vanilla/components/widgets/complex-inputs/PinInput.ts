// ============================================================
// PinInput — Vanilla DOM Widget
//
// One-time password / PIN code input with individual digit fields.
// ============================================================

export interface PinInputProps {
  length?: number;
  value?: string;
  type?: "numeric" | "alphanumeric";
  mask?: boolean;
  disabled?: boolean;
  otp?: boolean;
  onComplete?: (value: string) => void;
  onChange?: (value: string) => void;
  className?: string;
}

export interface PinInputOptions { target: HTMLElement; props: PinInputProps; }

let _pinInputUid = 0;

export class PinInput {
  private el: HTMLElement;
  private props: PinInputProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PinInputOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `pin-input-${++_pinInputUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'pin-input');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PinInputProps>): void {
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
