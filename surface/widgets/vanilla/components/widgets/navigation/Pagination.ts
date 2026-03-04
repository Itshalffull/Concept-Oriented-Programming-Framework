// ============================================================
// Pagination — Vanilla DOM Widget
//
// Page navigation with prev/next buttons and page numbers.
// ============================================================

export interface PaginationProps {
  page?: number;
  defaultPage?: number;
  count: number;
  siblingCount?: number;
  boundaryCount?: number;
  onChange?: (page: number) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface PaginationOptions { target: HTMLElement; props: PaginationProps; }

let _paginationUid = 0;

export class Pagination {
  private el: HTMLElement;
  private props: PaginationProps;
  private uid: string;
  private state = 'idle';

  constructor(options: PaginationOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `pagination-${++_paginationUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'pagination');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<PaginationProps>): void {
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
