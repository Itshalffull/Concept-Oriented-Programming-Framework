// ============================================================
// Sidebar — Vanilla DOM Widget
//
// Collapsible sidebar navigation with groups and items.
// ============================================================

export interface SidebarProps {
  items: { label: string; href?: string; icon?: string; active?: boolean; children?: { label: string; href?: string }[] }[];
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
  width?: string;
  className?: string;
}

export interface SidebarOptions { target: HTMLElement; props: SidebarProps; }

let _sidebarUid = 0;

export class Sidebar {
  private el: HTMLElement;
  private props: SidebarProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SidebarOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `sidebar-${++_sidebarUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'sidebar');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SidebarProps>): void {
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
