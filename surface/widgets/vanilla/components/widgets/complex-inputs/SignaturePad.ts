// ============================================================
// SignaturePad — Vanilla DOM Widget
//
// Canvas-based signature drawing pad with clear and undo.
// ============================================================

export interface SignaturePadProps {
  value?: string;
  width?: number;
  height?: number;
  penColor?: string;
  backgroundColor?: string;
  disabled?: boolean;
  onChange?: (dataUrl: string) => void;
  onClear?: () => void;
  className?: string;
}

export interface SignaturePadOptions { target: HTMLElement; props: SignaturePadProps; }

let _signaturePadUid = 0;

export class SignaturePad {
  private el: HTMLElement;
  private props: SignaturePadProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SignaturePadOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `signature-pad-${++_signaturePadUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'signature-pad');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SignaturePadProps>): void {
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
