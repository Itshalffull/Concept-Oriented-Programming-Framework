// ============================================================
// Breadcrumb — Vanilla DOM Widget
//
// Navigation breadcrumb trail with links and separator.
// ============================================================

export interface BreadcrumbProps {
  items: { label: string; href?: string }[];
  separator?: string;
  className?: string;
}

export interface BreadcrumbOptions { target: HTMLElement; props: BreadcrumbProps; }

let _breadcrumbUid = 0;

export class Breadcrumb {
  private el: HTMLElement;
  private props: BreadcrumbProps;
  private uid: string;
  private state = 'idle';

  constructor(options: BreadcrumbOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `breadcrumb-${++_breadcrumbUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'breadcrumb');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<BreadcrumbProps>): void {
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
