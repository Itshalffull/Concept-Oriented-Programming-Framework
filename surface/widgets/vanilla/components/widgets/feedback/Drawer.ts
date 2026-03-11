// ============================================================
// Drawer — Vanilla DOM Widget
//
// Slide-in panel from edge of viewport.
// ============================================================

export interface DrawerProps {
  open?: boolean;
  placement?: "left" | "right" | "top" | "bottom";
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface DrawerOptions { target: HTMLElement; props: DrawerProps; }

let _drawerUid = 0;

export class Drawer {
  private el: HTMLElement;
  private props: DrawerProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DrawerOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `drawer-${++_drawerUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'drawer');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DrawerProps>): void {
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
