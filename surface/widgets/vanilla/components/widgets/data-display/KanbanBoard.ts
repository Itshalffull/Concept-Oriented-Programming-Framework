// ============================================================
// KanbanBoard — Vanilla DOM Widget
//
// Drag-and-drop Kanban board with columns and cards.
// ============================================================

export interface KanbanBoardProps {
  columns: { id: string; title: string; items: { id: string; title: string; description?: string }[] }[];
  onItemMove?: (itemId: string, fromCol: string, toCol: string) => void;
  loading?: boolean;
  className?: string;
}

export interface KanbanBoardOptions { target: HTMLElement; props: KanbanBoardProps; }

let _kanbanBoardUid = 0;

export class KanbanBoard {
  private el: HTMLElement;
  private props: KanbanBoardProps;
  private uid: string;
  private state = 'idle';

  constructor(options: KanbanBoardOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `kanban-board-${++_kanbanBoardUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'kanban-board');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<KanbanBoardProps>): void {
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
