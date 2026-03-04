// ============================================================
// InlineEdit — Vanilla DOM Widget
//
// Click-to-edit inline text field with confirm/cancel.
// ============================================================

export interface InlineEditProps {
  value: string;
  placeholder?: string;
  disabled?: boolean;
  selectOnFocus?: boolean;
  onSubmit?: (value: string) => void;
  onCancel?: () => void;
  className?: string;
}

export interface InlineEditOptions { target: HTMLElement; props: InlineEditProps; }

let _inlineEditUid = 0;

export class InlineEdit {
  private el: HTMLElement;
  private props: InlineEditProps;
  private uid: string;
  private state = 'idle';

  constructor(options: InlineEditOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `inline-edit-${++_inlineEditUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'inline-edit');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<InlineEditProps>): void {
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
