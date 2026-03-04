// ============================================================
// AlertDialog — Vanilla DOM Widget
//
// Modal confirmation dialog with confirm/cancel actions.
// ============================================================

export interface AlertDialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface AlertDialogOptions { target: HTMLElement; props: AlertDialogProps; }

let _alertDialogUid = 0;

export class AlertDialog {
  private el: HTMLElement;
  private props: AlertDialogProps;
  private uid: string;
  private state = 'idle';

  constructor(options: AlertDialogOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `alert-dialog-${++_alertDialogUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'alert-dialog');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<AlertDialogProps>): void {
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
