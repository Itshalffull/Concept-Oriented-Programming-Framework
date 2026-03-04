// ============================================================
// ViewSwitcher — Vanilla DOM Widget
//
// View type switcher with save/load named views.
// ============================================================

export interface ViewSwitcherProps {
  views: { id: string; label: string; type: string }[];
  activeViewId?: string;
  onViewChange?: (id: string) => void;
  onSaveView?: (id: string) => void;
  onDeleteView?: (id: string) => void;
  className?: string;
}

export interface ViewSwitcherOptions { target: HTMLElement; props: ViewSwitcherProps; }

let _viewSwitcherUid = 0;

export class ViewSwitcher {
  private el: HTMLElement;
  private props: ViewSwitcherProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ViewSwitcherOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `view-switcher-${++_viewSwitcherUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'view-switcher');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ViewSwitcherProps>): void {
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
