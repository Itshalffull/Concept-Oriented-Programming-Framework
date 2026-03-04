// ============================================================
// FilterBuilder — Vanilla DOM Widget
//
// Visual filter/query builder with add/remove rows.
// ============================================================

export interface FilterBuilderProps {
  fields: { name: string; label: string; type: string; operators: string[] }[];
  rows?: { field: string; operator: string; value: string }[];
  onRowsChange?: (rows: { field: string; operator: string; value: string }[]) => void;
  className?: string;
}

export interface FilterBuilderOptions { target: HTMLElement; props: FilterBuilderProps; }

let _filterBuilderUid = 0;

export class FilterBuilder {
  private el: HTMLElement;
  private props: FilterBuilderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FilterBuilderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `filter-builder-${++_filterBuilderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'filter-builder');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FilterBuilderProps>): void {
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
