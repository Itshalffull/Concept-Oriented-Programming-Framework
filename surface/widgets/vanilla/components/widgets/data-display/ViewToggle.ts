// ============================================================
// ViewToggle — Vanilla DOM Widget
//
// Toggle between grid and list view layouts.
// ============================================================

export interface ViewToggleProps {
  options: { value: string; label: string; icon?: string }[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ViewToggleOptions { target: HTMLElement; props: ViewToggleProps; }

let _viewToggleUid = 0;

export class ViewToggle {
  private el: HTMLElement;
  private props: ViewToggleProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ViewToggleOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `view-toggle-${++_viewToggleUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'view-toggle');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ViewToggleProps>): void {
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
