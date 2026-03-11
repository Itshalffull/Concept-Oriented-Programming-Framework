// ============================================================
// DragHandle — Vanilla DOM Widget
//
// Drag handle grip for reorderable items.
// ============================================================

export interface DragHandleProps {
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
}

export interface DragHandleOptions { target: HTMLElement; props: DragHandleProps; }

let _dragHandleUid = 0;

export class DragHandle {
  private el: HTMLElement;
  private props: DragHandleProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DragHandleOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `drag-handle-${++_dragHandleUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'drag-handle');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DragHandleProps>): void {
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
