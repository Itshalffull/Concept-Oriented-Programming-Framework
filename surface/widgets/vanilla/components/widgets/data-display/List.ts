// ============================================================
// List — Vanilla DOM Widget
//
// Ordered or unordered list with selectable items.
// ============================================================

export interface ListProps {
  items: { id: string; label: string; description?: string; disabled?: boolean }[];
  variant?: "ordered" | "unordered";
  selectable?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface ListOptions { target: HTMLElement; props: ListProps; }

let _listUid = 0;

export class List {
  private el: HTMLElement;
  private props: ListProps;
  private uid: string;
  private state = 'idle';

  constructor(options: ListOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `list-${++_listUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'list');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<ListProps>): void {
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
