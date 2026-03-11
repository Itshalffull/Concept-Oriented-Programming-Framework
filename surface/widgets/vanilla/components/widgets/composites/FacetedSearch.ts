// ============================================================
// FacetedSearch — Vanilla DOM Widget
//
// Search with facet filters, active filter chips, and results.
// ============================================================

export interface FacetedSearchProps {
  query?: string;
  facets?: { name: string; label: string; items: { value: string; label: string; count?: number }[] }[];
  activeFilters?: { facet: string; value: string }[];
  onQueryChange?: (query: string) => void;
  onFilterChange?: (filters: { facet: string; value: string }[]) => void;
  loading?: boolean;
  className?: string;
}

export interface FacetedSearchOptions { target: HTMLElement; props: FacetedSearchProps; }

let _facetedSearchUid = 0;

export class FacetedSearch {
  private el: HTMLElement;
  private props: FacetedSearchProps;
  private uid: string;
  private state = 'idle';

  constructor(options: FacetedSearchOptions) {
    const { target, props } = options;
    this.props = { ...props };
    this.uid = `faceted-search-${++_facetedSearchUid}`;

    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'faceted-search');
    this.el.setAttribute('data-part', 'root');
    if (this.props.className) this.el.className = this.props.className;

    this.render();
    target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }

  update(props: Partial<FacetedSearchProps>): void {
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
