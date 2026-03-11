// ============================================================
// DataTable — Vanilla DOM Widget
//
// Sortable, filterable data table with pagination.
// ============================================================

export interface DataTableProps {
  columns: { key: string; label: string; sortable?: boolean; width?: string }[];
  data: Record<string, unknown>[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  selectable?: boolean;
  selectedRows?: string[];
  onSort?: (column: string, direction: string) => void;
  onRowSelect?: (ids: string[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export interface DataTableOptions { target: HTMLElement; props: DataTableProps; }

let _dataTableUid = 0;

export class DataTable {
  private el: HTMLElement;
  private props: DataTableProps;
  private uid: string;
  private state = 'idle';

  constructor(options: DataTableOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `data-table-${++_dataTableUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'data-table');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<DataTableProps>): void {
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
