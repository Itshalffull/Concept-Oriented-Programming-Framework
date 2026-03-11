// ============================================================
// Menu — Vanilla DOM Widget
//
// Dropdown menu with keyboard-navigable items and submenus.
// ============================================================

export interface MenuProps {
  open?: boolean;
  items: { label: string; value: string; disabled?: boolean; shortcut?: string }[];
  onSelect?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export interface MenuOptions { target: HTMLElement; props: MenuProps; }

let _menuUid = 0;

export class Menu {
  private el: HTMLElement;
  private props: MenuProps;
  private uid: string;
  private state = 'idle';

  constructor(options: MenuOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `menu-${++_menuUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'menu');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<MenuProps>): void {
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
