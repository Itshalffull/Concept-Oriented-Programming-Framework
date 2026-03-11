// ============================================================
// SortBuilder — Vanilla DOM Widget
//
// Multi-criteria sort builder with drag-to-reorder.
// ============================================================

export interface SortBuilderProps {
  fields: { name: string; label: string }[];
  criteria?: { field: string; direction: "asc" | "desc" }[];
  onCriteriaChange?: (criteria: { field: string; direction: "asc" | "desc" }[]) => void;
  className?: string;
}

export interface SortBuilderOptions { target: HTMLElement; props: SortBuilderProps; }

let _sortBuilderUid = 0;

export class SortBuilder {
  private el: HTMLElement;
  private props: SortBuilderProps;
  private uid: string;
  private state = 'idle';

  constructor(options: SortBuilderOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `sort-builder-${++_sortBuilderUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'sort-builder');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<SortBuilderProps>): void {
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
