import { uid } from '../shared/uid.js';

export interface FacetDef {
  key: string;
  name: string;
  type: 'checkbox' | 'radio' | 'range';
  items?: FacetItemDef[];
  min?: number;
  max?: number;
}

export interface FacetItemDef {
  value: string;
  label: string;
  count: number;
}

export interface ActiveFilter {
  facetKey: string;
  facetName: string;
  value: string;
  displayValue: string;
}

export interface FacetedSearchProps {
  query?: string;
  facets: FacetDef[];
  activeFilters?: ActiveFilter[];
  results?: Record<string, unknown>[];
  totalCount?: number;
  page?: number;
  pageSize?: number;
  loading?: boolean;
  facetTruncateAt?: number;
  showResultCount?: boolean;
  showPagination?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  onChange?: (query: string, filters: ActiveFilter[]) => void;
  onSearch?: (query: string) => void;
  onPageChange?: (page: number) => void;
  renderResult?: (result: Record<string, unknown>, index: number) => string | HTMLElement;
  renderFacetItem?: (item: FacetItemDef, active: boolean) => string | HTMLElement;
  children?: string | HTMLElement;
}

export interface FacetedSearchInstance {
  element: HTMLElement;
  update(props: Partial<FacetedSearchProps>): void;
  destroy(): void;
}

export function createFacetedSearch(options: {
  target: HTMLElement;
  props: FacetedSearchProps;
}): FacetedSearchInstance {
  const { target, props } = options;
  let currentProps = { ...props };
  const id = uid();
  const cleanups: (() => void)[] = [];

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'faceted-search');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'search');
  root.id = id;

  const searchInputEl = document.createElement('input');
  searchInputEl.setAttribute('data-part', 'search-input');
  searchInputEl.setAttribute('type', 'search');
  searchInputEl.setAttribute('aria-label', 'Search');
  root.appendChild(searchInputEl);

  const activeFiltersEl = document.createElement('div');
  activeFiltersEl.setAttribute('data-part', 'active-filters');
  activeFiltersEl.setAttribute('role', 'list');
  activeFiltersEl.setAttribute('aria-label', 'Active filters');
  root.appendChild(activeFiltersEl);

  const clearAllBtn = document.createElement('button');
  clearAllBtn.setAttribute('data-part', 'clear-all-button');
  clearAllBtn.setAttribute('type', 'button');
  clearAllBtn.setAttribute('aria-label', 'Clear all filters');
  clearAllBtn.textContent = 'Clear all';
  root.appendChild(clearAllBtn);

  const layoutEl = document.createElement('div');
  layoutEl.setAttribute('data-part', 'layout');
  root.appendChild(layoutEl);

  const facetSidebarEl = document.createElement('div');
  facetSidebarEl.setAttribute('data-part', 'facet-sidebar');
  facetSidebarEl.setAttribute('role', 'complementary');
  facetSidebarEl.setAttribute('aria-label', 'Search filters');
  layoutEl.appendChild(facetSidebarEl);

  const resultsEl = document.createElement('div');
  resultsEl.setAttribute('data-part', 'results');
  resultsEl.setAttribute('role', 'region');
  resultsEl.setAttribute('aria-label', 'Search results');
  layoutEl.appendChild(resultsEl);

  const resultCountEl = document.createElement('span');
  resultCountEl.setAttribute('data-part', 'result-count');
  resultCountEl.setAttribute('aria-live', 'polite');
  resultsEl.appendChild(resultCountEl);

  const resultListEl = document.createElement('div');
  resultListEl.setAttribute('data-part', 'result-list');
  resultListEl.setAttribute('role', 'list');
  resultsEl.appendChild(resultListEl);

  searchInputEl.addEventListener('input', () => {
    currentProps.onSearch?.(searchInputEl.value);
    currentProps.onChange?.(searchInputEl.value, currentProps.activeFilters ?? []);
  });
  cleanups.push(() => {});
  clearAllBtn.addEventListener('click', () => {
    currentProps.onChange?.(currentProps.query ?? '', []);
  });

  function renderActiveFilters() {
    activeFiltersEl.innerHTML = '';
    const filters = currentProps.activeFilters ?? [];
    filters.forEach(f => {
      const chip = document.createElement('span');
      chip.setAttribute('data-part', 'active-chip');
      chip.setAttribute('role', 'listitem');
      chip.textContent = f.displayValue;
      const removeBtn = document.createElement('button');
      removeBtn.setAttribute('type', 'button');
      removeBtn.setAttribute('aria-label', 'Remove ' + f.displayValue);
      removeBtn.textContent = '\u00d7';
      removeBtn.addEventListener('click', () => {
        const next = (currentProps.activeFilters ?? []).filter(af => af !== f);
        currentProps.onChange?.(currentProps.query ?? '', next);
      });
      chip.appendChild(removeBtn);
      activeFiltersEl.appendChild(chip);
    });
    clearAllBtn.style.display = filters.length > 0 ? '' : 'none';
  }

  function renderResults() {
    resultListEl.innerHTML = '';
    (currentProps.results ?? []).forEach((r, i) => {
      const el = document.createElement('div');
      el.setAttribute('data-part', 'result-item');
      el.setAttribute('role', 'listitem');
      if (currentProps.renderResult) {
        const rendered = currentProps.renderResult(r, i);
        if (typeof rendered === 'string') el.innerHTML = rendered;
        else el.appendChild(rendered);
      }
      resultListEl.appendChild(el);
    });
  }

  function sync() {
    const loading = currentProps.loading ?? false;
    root.setAttribute('data-state', loading ? 'loading' : 'idle');
    root.setAttribute('aria-busy', loading ? 'true' : 'false');
    searchInputEl.value = currentProps.query ?? '';
    searchInputEl.placeholder = currentProps.placeholder ?? 'Search...';
    renderActiveFilters();
    renderResults();
    resultCountEl.textContent = currentProps.showResultCount ? (currentProps.totalCount ?? 0) + ' results' : '';
    resultCountEl.style.display = currentProps.showResultCount ? '' : 'none';
  }

  sync();
  target.appendChild(root);

  return {
    element: root,
    update(next) { Object.assign(currentProps, next); sync(); },
    destroy() { cleanups.forEach(fn => fn()); root.remove(); },
  };
}

export default createFacetedSearch;
