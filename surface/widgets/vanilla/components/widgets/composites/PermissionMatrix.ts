// ============================================================
// PermissionMatrix — Vanilla DOM Widget
//
// Role-permission matrix grid with toggleable cells.
// ============================================================

export interface PermissionMatrixProps {
  roles: { id: string; name: string }[];
  resources: { id: string; name: string }[];
  actions: { id: string; name: string }[];
  permissions?: Record<string, Record<string, string[]>>;
  onPermissionChange?: (roleId: string, resourceId: string, actionId: string, granted: boolean) => void;
  readOnly?: boolean;
  className?: string;
}

export interface PermissionMatrixOptions { target: HTMLElement; props: PermissionMatrixProps; }

let _permissionMatrixUid = 0;

export class PermissionMatrix {
  private el: HTMLElement;
  private props: PermissionMatrixProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PermissionMatrixOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `permission-matrix-${++_permissionMatrixUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'permission-matrix');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PermissionMatrixProps>): void {
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
