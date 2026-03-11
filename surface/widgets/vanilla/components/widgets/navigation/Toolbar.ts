// ============================================================
// Toolbar — Vanilla DOM Widget
//
// Horizontal toolbar with groups of action buttons.
// ============================================================

export interface ToolbarProps {
  orientation?: "horizontal" | "vertical";
  ariaLabel?: string;
  className?: string;
}

export interface ToolbarOptions { target: HTMLElement; props: ToolbarProps; }

let _toolbarUid = 0;

export class Toolbar {
  private el: HTMLElement;
  private props: ToolbarProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ToolbarOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `toolbar-${++_toolbarUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'toolbar');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ToolbarProps>): void {
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
