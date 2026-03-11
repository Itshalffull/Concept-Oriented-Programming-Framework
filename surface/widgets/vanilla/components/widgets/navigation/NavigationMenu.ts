// ============================================================
// NavigationMenu — Vanilla DOM Widget
//
// Horizontal navigation menu with dropdown sub-menus.
// ============================================================

export interface NavigationMenuProps {
  items: { label: string; href?: string; children?: { label: string; href?: string }[] }[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export interface NavigationMenuOptions { target: HTMLElement; props: NavigationMenuProps; }

let _navigationMenuUid = 0;

export class NavigationMenu {
  private el: HTMLElement;
  private props: NavigationMenuProps;
  private uid: string;
  private state = 'idle';

  constructor(options: NavigationMenuOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `navigation-menu-${++_navigationMenuUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'navigation-menu');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<NavigationMenuProps>): void {
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
