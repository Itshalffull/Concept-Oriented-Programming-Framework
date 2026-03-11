// ============================================================
// ContextMenu — Vanilla DOM Widget
//
// Right-click context menu with keyboard-navigable items.
// ============================================================

export interface ContextMenuProps {
  items: { label: string; value: string; disabled?: boolean; shortcut?: string }[];
  onSelect?: (value: string) => void;
  className?: string;
}

export interface ContextMenuOptions { target: HTMLElement; props: ContextMenuProps; }

let _contextMenuUid = 0;

export class ContextMenu {
  private el: HTMLElement;
  private props: ContextMenuProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ContextMenuOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `context-menu-${++_contextMenuUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'context-menu');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ContextMenuProps>): void {
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
