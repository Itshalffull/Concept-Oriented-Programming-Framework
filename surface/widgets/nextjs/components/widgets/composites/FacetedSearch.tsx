'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { facetedSearchReducer } from './FacetedSearch.reducer.js';

/* ---------------------------------------------------------------------------
 * Types derived from faceted-search.widget spec props
 * ------------------------------------------------------------------------- */

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

export interface FacetedSearchProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
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
  renderResult?: (result: Record<string, unknown>, index: number) => ReactNode;
  renderFacetItem?: (item: FacetItemDef, active: boolean) => ReactNode;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export const FacetedSearch = forwardRef<HTMLDivElement, FacetedSearchProps>(
  function FacetedSearch(
    {
      query: controlledQuery = '',
      facets,
      activeFilters = [],
      results = [],
      totalCount = 0,
      page = 1,
      pageSize = 20,
      loading = false,
      facetTruncateAt = 5,
      showResultCount = true,
      showPagination = true,
      placeholder = 'Search...',
      emptyMessage = 'No results found',
      onChange,
      onSearch,
      onPageChange,
      renderResult,
      renderFacetItem,
      children,
      ...rest
    },
    ref,
  ) {
    const initialExpanded = new Set(facets.map((f) => f.key));
    const [state, send] = useReducer(facetedSearchReducer, {
      search: results.length > 0 ? 'hasResults' : 'idle',
      expandedFacets: initialExpanded,
      expandedShowMore: new Set(),
      query: controlledQuery,
    });

    const effectiveQuery = controlledQuery ?? state.query;

    const isFilterActive = (facetKey: string, value: string) =>
      activeFilters.some((f) => f.facetKey === facetKey && f.value === value);

    const handleSearch = useCallback(
      (query: string) => {
        send({ type: 'SET_QUERY', query });
        onSearch?.(query);
        onChange?.(query, activeFilters);
      },
      [onSearch, onChange, activeFilters],
    );

    const handleApplyFacet = useCallback(
      (facetKey: string, facetName: string, value: string, displayValue: string) => {
        const next = [...activeFilters, { facetKey, facetName, value, displayValue }];
        onChange?.(effectiveQuery, next);
      },
      [effectiveQuery, activeFilters, onChange],
    );

    const handleRemoveFacet = useCallback(
      (facetKey: string, value: string) => {
        const next = activeFilters.filter(
          (f) => !(f.facetKey === facetKey && f.value === value),
        );
        onChange?.(effectiveQuery, next);
      },
      [effectiveQuery, activeFilters, onChange],
    );

    const handleClearAll = useCallback(() => {
      onChange?.('', []);
    }, [onChange]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
      <div
        ref={ref}
        role="search"
        aria-label="Faceted search"
        data-surface-widget=""
        data-widget-name="faceted-search"
        data-part="root"
        data-state={loading ? 'loading' : results.length === 0 ? 'empty' : 'has-results'}
        {...rest}
      >
        {/* Search Input */}
        <input
          type="search"
          data-part="search-input"
          value={effectiveQuery}
          placeholder={placeholder}
          aria-label="Search"
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleSearch('');
          }}
        />

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div
            role="list"
            aria-label="Active filters"
            data-part="active-filters"
            data-count={activeFilters.length}
          >
            {activeFilters.map((filter) => (
              <span
                key={`${filter.facetKey}-${filter.value}`}
                role="listitem"
                data-part="active-chip"
                data-facet={filter.facetKey}
                data-value={filter.value}
                aria-label={`${filter.facetName}: ${filter.displayValue}`}
              >
                {filter.displayValue}
                <button
                  type="button"
                  aria-label={`Remove ${filter.facetName}: ${filter.displayValue}`}
                  onClick={() => handleRemoveFacet(filter.facetKey, filter.value)}
                >
                  &times;
                </button>
              </span>
            ))}
            <button
              type="button"
              data-part="clear-all-button"
              aria-label="Clear all filters"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          </div>
        )}

        <div data-part="layout">
          {/* Facet Sidebar */}
          <div
            role="complementary"
            aria-label="Search filters"
            data-part="facet-sidebar"
          >
            {facets.map((facet) => {
              const isExpanded = state.expandedFacets.has(facet.key);
              const isShowingMore = state.expandedShowMore.has(facet.key);
              const items = facet.items ?? [];
              const visibleItems = isShowingMore ? items : items.slice(0, facetTruncateAt);

              return (
                <div
                  key={facet.key}
                  role="group"
                  aria-labelledby={`facet-label-${facet.key}`}
                  aria-expanded={isExpanded ? 'true' : 'false'}
                  data-part="facet-group"
                  data-facet={facet.key}
                  data-state={isExpanded ? 'expanded' : 'collapsed'}
                >
                  <button
                    type="button"
                    data-part="facet-label"
                    id={`facet-label-${facet.key}`}
                    onClick={() =>
                      send({
                        type: isExpanded ? 'COLLAPSE_FACET' : 'EXPAND_FACET',
                        key: facet.key,
                      })
                    }
                  >
                    {facet.name}
                  </button>

                  {isExpanded && (
                    <div
                      role="group"
                      aria-label={facet.name}
                      data-part="facet-items"
                    >
                      {facet.type === 'range' ? (
                        <input
                          type="range"
                          data-part="range-slider"
                          data-facet={facet.key}
                          min={facet.min}
                          max={facet.max}
                          aria-label={`${facet.name} range`}
                          onChange={(e) =>
                            handleApplyFacet(facet.key, facet.name, e.target.value, e.target.value)
                          }
                        />
                      ) : (
                        visibleItems.map((item) => {
                          const active = isFilterActive(facet.key, item.value);
                          return (
                            <label
                              key={item.value}
                              data-part="facet-item"
                              data-facet={facet.key}
                              data-value={item.value}
                              data-active={active ? 'true' : 'false'}
                              data-count={item.count}
                            >
                              {renderFacetItem ? (
                                renderFacetItem(item, active)
                              ) : (
                                <>
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    onChange={() =>
                                      active
                                        ? handleRemoveFacet(facet.key, item.value)
                                        : handleApplyFacet(facet.key, facet.name, item.value, item.label)
                                    }
                                  />
                                  {item.label}
                                  <span data-part="facet-count" aria-hidden="true">
                                    ({item.count})
                                  </span>
                                </>
                              )}
                            </label>
                          );
                        })
                      )}

                      {items.length > facetTruncateAt && (
                        <button
                          type="button"
                          data-part="facet-show-more"
                          aria-label={isShowingMore ? `Show less ${facet.name}` : `Show more ${facet.name}`}
                          data-state={isShowingMore ? 'full' : 'truncated'}
                          onClick={() =>
                            send({
                              type: isShowingMore ? 'SHOW_LESS' : 'SHOW_MORE',
                              key: facet.key,
                            })
                          }
                        >
                          {isShowingMore ? 'Show less' : `Show more (${items.length - facetTruncateAt})`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Results */}
          <div
            role="region"
            aria-label="Search results"
            aria-live="polite"
            aria-busy={loading ? 'true' : 'false'}
            data-part="results"
            data-state={loading ? 'loading' : results.length === 0 ? 'empty' : 'has-results'}
          >
            {showResultCount && (
              <span
                data-part="result-count"
                aria-live="polite"
                aria-atomic="true"
              >
                {totalCount} result{totalCount !== 1 ? 's' : ''}
              </span>
            )}

            <div data-part="result-list" data-count={results.length}>
              {results.map((result, i) => (
                <div key={i} data-part="result-item">
                  {renderResult ? renderResult(result, i) : JSON.stringify(result)}
                </div>
              ))}
            </div>

            {!loading && results.length === 0 && (
              <div data-part="empty-state">{emptyMessage}</div>
            )}

            {loading && (
              <div data-part="loading-state" aria-hidden="false">Loading...</div>
            )}

            {showPagination && totalCount > pageSize && (
              <nav data-part="pagination" aria-label="Search results pagination">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => onPageChange?.(page - 1)}
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => onPageChange?.(page + 1)}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </div>

        {children}
      </div>
    );
  },
);

FacetedSearch.displayName = 'FacetedSearch';
export default FacetedSearch;
