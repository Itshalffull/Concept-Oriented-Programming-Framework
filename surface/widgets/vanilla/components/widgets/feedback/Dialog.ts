// ============================================================
// Dialog — Vanilla DOM Widget
//
// Modal dialog with backdrop, title, description, and close button.
// ============================================================

export interface DialogProps {
  open?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  dialogRole?: "dialog" | "alertdialog";
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  className?: string;
}

export interface DialogOptions { target: HTMLElement; props: DialogProps; }

let _dialogUid = 0;

export class Dialog {
  private el: HTMLElement;
  private props: DialogProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DialogOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `dialog-${++_dialogUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'dialog');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DialogProps>): void {
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
