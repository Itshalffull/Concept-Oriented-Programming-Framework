/* ---------------------------------------------------------------------------
 * RegistrySearch — Server Component
 *
 * Search interface for the package registry with type-ahead suggestions,
 * paginated results, keyword badges, and download counts.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface RegistrySearchResult {
  name: string;
  version: string;
  description: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
}

export interface RegistrySearchProps {
  /** Current search query string. */
  query: string;
  /** Search results to display. */
  results: RegistrySearchResult[];
  /** Sort order for results. */
  sortBy?: 'relevance' | 'downloads' | 'date';
  /** Number of results per page. */
  pageSize?: number;
  /** Whether the search is currently loading. */
  loading?: boolean;
  /** Placeholder text for the search input. */
  placeholder?: string;
  /** Current page (0-indexed). */
  page?: number;
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function RegistrySearch({
  query,
  results,
  sortBy: _sortBy = 'relevance',
  pageSize = 20,
  loading = false,
  placeholder = 'Search packages\u2026',
  page = 0,
  children,
}: RegistrySearchProps) {
  const state = loading ? 'searching' : 'idle';
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const start = page * pageSize;
  const paginatedResults = results.slice(start, start + pageSize);

  return (
    <div
      role="search"
      aria-label="Package registry search"
      data-surface-widget=""
      data-widget-name="registry-search"
      data-part="root"
      data-state={state}
      tabIndex={0}
    >
      {/* Search input with combobox pattern */}
      <div data-part="search" data-state={state}>
        <input
          type="search"
          data-part="search-input"
          role="combobox"
          aria-label="Search packages"
          aria-expanded={paginatedResults.length > 0}
          aria-controls="registry-search-results"
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          defaultValue={query}
        />
      </div>

      {/* Suggestions dropdown */}
      <div
        data-part="suggestions"
        data-state={state}
        data-visible={state === 'searching' ? 'true' : 'false'}
        role="listbox"
        aria-label="Suggestions"
      >
        {state === 'searching' && loading && (
          <div data-part="suggestion-loading" role="status" aria-live="polite">
            Searching{'\u2026'}
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div data-part="loading" role="status" aria-live="polite" aria-label="Loading search results">
          Loading results{'\u2026'}
        </div>
      )}

      {/* Result list */}
      <div
        id="registry-search-results"
        data-part="results"
        data-state={state}
        role="listbox"
        aria-label="Search results"
      >
        {paginatedResults.map((result, index) => (
          <div
            key={`${result.name}@${result.version}`}
            id={`registry-search-result-${index}`}
            data-part="result"
            data-state={state}
            role="option"
            aria-selected={false}
            aria-label={`${result.name}@${result.version}`}
            tabIndex={-1}
          >
            <span data-part="name">{result.name}</span>
            <span data-part="version">{result.version}</span>
            <span data-part="desc">{result.description}</span>

            {result.downloads != null && (
              <span data-part="downloads" aria-label={`${result.downloads} downloads`}>
                {formatDownloads(result.downloads)}
              </span>
            )}

            {result.author && (
              <span data-part="author">{result.author}</span>
            )}

            {result.keywords && result.keywords.length > 0 && (
              <div data-part="keywords">
                {result.keywords.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    data-part="keyword"
                    aria-label={`Filter by keyword: ${kw}`}
                    tabIndex={-1}
                  >
                    {kw}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div data-part="pagination" data-state={state} role="navigation" aria-label="Search result pages">
          <button
            type="button"
            data-part="pagination-prev"
            aria-label="Previous page"
            disabled={page === 0}
          >
            Previous
          </button>
          <span data-part="pagination-info" aria-current="page">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            data-part="pagination-next"
            aria-label="Next page"
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && query.trim() !== '' && results.length === 0 && (
        <div data-part="empty" data-state={state} data-visible="true" role="status" aria-live="polite">
          No packages found for &ldquo;{query}&rdquo;. Try a different search term.
        </div>
      )}

      {!loading && query.trim() === '' && results.length === 0 && (
        <div data-part="empty" data-state={state} data-visible="true" role="status" aria-live="polite">
          Enter a search term to find packages.
        </div>
      )}

      {children}
    </div>
  );
}

export { RegistrySearch };
