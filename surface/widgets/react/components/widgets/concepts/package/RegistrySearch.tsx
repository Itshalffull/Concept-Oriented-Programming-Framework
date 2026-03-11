/* ---------------------------------------------------------------------------
 * RegistrySearch state machine
 * States: idle (initial), searching
 * See widget spec: registry-search.widget
 * ------------------------------------------------------------------------- */

export type RegistrySearchState = 'idle' | 'searching';
export type RegistrySearchEvent =
  | { type: 'INPUT' }
  | { type: 'SELECT_RESULT' }
  | { type: 'RESULTS' }
  | { type: 'CLEAR' };

export function registrySearchReducer(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState {
  switch (state) {
    case 'idle':
      if (event.type === 'INPUT') return 'searching';
      if (event.type === 'SELECT_RESULT') return 'idle';
      return state;
    case 'searching':
      if (event.type === 'RESULTS') return 'idle';
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

/* ---------------------------------------------------------------------------
 * Result item type
 * ------------------------------------------------------------------------- */

export interface RegistrySearchResult {
  name: string;
  version: string;
  description: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
}

/* ---------------------------------------------------------------------------
 * Download count formatter
 * ------------------------------------------------------------------------- */

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface RegistrySearchProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
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
  /** Fired when the user types a search query (debounced). */
  onSearch?: (query: string) => void;
  /** Fired when the user selects a package from the results. */
  onSelect?: (packageName: string) => void;
  /** Fired when a keyword badge is clicked to filter. */
  onKeywordClick?: (keyword: string) => void;
  /** Optional children rendered after the widget content. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const DEBOUNCE_MS = 200;

const RegistrySearch = forwardRef<HTMLDivElement, RegistrySearchProps>(function RegistrySearch(
  {
    query,
    results,
    sortBy = 'relevance',
    pageSize = 20,
    loading = false,
    placeholder = 'Search packages\u2026',
    onSearch,
    onSelect,
    onKeywordClick,
    children,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(registrySearchReducer, 'idle');
  const [internalQuery, setInternalQuery] = useState(query);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [page, setPage] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Sync external query prop */
  useEffect(() => {
    setInternalQuery(query);
  }, [query]);

  /* Transition to idle when results arrive while searching */
  useEffect(() => {
    if (state === 'searching' && !loading && results.length >= 0) {
      send({ type: 'RESULTS' });
    }
  }, [results, loading, state]);

  /* Paginated results */
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const paginatedResults = useMemo(() => {
    const start = page * pageSize;
    return results.slice(start, start + pageSize);
  }, [results, page, pageSize]);

  /* Focus a result item by index */
  const focusResult = useCallback((index: number) => {
    const clamped = Math.max(-1, Math.min(index, paginatedResults.length - 1));
    setFocusIndex(clamped);
    if (clamped >= 0) {
      const el = resultRefs.current.get(clamped);
      el?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [paginatedResults.length]);

  /* Input change handler with debounce */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInternalQuery(value);
    setFocusIndex(-1);
    setPage(0);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim()) {
      send({ type: 'INPUT' });
      debounceRef.current = setTimeout(() => {
        onSearch?.(value);
      }, DEBOUNCE_MS);
    } else {
      send({ type: 'CLEAR' });
      onSearch?.('');
    }
  }, [onSearch]);

  /* Cleanup debounce on unmount */
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  /* Select a result */
  const handleSelect = useCallback((packageName: string) => {
    send({ type: 'SELECT_RESULT' });
    onSelect?.(packageName);
  }, [onSelect]);

  /* Keyword click handler */
  const handleKeywordClick = useCallback((keyword: string) => {
    setInternalQuery(keyword);
    setPage(0);
    send({ type: 'INPUT' });
    onKeywordClick?.(keyword);
    onSearch?.(keyword);
  }, [onKeywordClick, onSearch]);

  /* Root keyboard handler */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = focusIndex < paginatedResults.length - 1 ? focusIndex + 1 : 0;
        focusResult(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (focusIndex <= 0) {
          focusResult(-1);
        } else {
          focusResult(focusIndex - 1);
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (focusIndex >= 0 && focusIndex < paginatedResults.length) {
          handleSelect(paginatedResults[focusIndex].name);
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        setInternalQuery('');
        setFocusIndex(-1);
        send({ type: 'CLEAR' });
        onSearch?.('');
        inputRef.current?.focus();
        break;
      }
      default:
        break;
    }
  }, [focusIndex, paginatedResults, focusResult, handleSelect, onSearch]);

  /* Determine aria-activedescendant */
  const activeDescendant = focusIndex >= 0 ? `registry-search-result-${focusIndex}` : undefined;

  return (
    <div
      ref={ref}
      role="search"
      aria-label="Package registry search"
      data-surface-widget=""
      data-widget-name="registry-search"
      data-part="root"
      data-state={state}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {/* Search input with combobox pattern */}
      <div data-part="search" data-state={state}>
        <input
          ref={inputRef}
          type="search"
          data-part="search-input"
          role="combobox"
          aria-label="Search packages"
          aria-expanded={state === 'searching' || paginatedResults.length > 0}
          aria-controls="registry-search-results"
          aria-activedescendant={activeDescendant}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={internalQuery}
          onChange={handleInputChange}
        />
      </div>

      {/* Suggestions dropdown (visible while searching) */}
      <div
        data-part="suggestions"
        data-state={state}
        data-visible={state === 'searching' ? 'true' : 'false'}
        role="listbox"
        aria-label="Suggestions"
      >
        {state === 'searching' && loading && (
          <div data-part="suggestion-loading" role="status" aria-live="polite">
            Searching\u2026
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div data-part="loading" role="status" aria-live="polite" aria-label="Loading search results">
          Loading results\u2026
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
        {paginatedResults.map((result, index) => {
          const isFocused = index === focusIndex;

          return (
            <div
              key={`${result.name}@${result.version}`}
              id={`registry-search-result-${index}`}
              ref={(el) => {
                if (el) resultRefs.current.set(index, el);
                else resultRefs.current.delete(index);
              }}
              data-part="result"
              data-state={state}
              role="option"
              aria-selected={isFocused}
              aria-label={`${result.name}@${result.version}`}
              tabIndex={isFocused ? 0 : -1}
              onClick={() => handleSelect(result.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(result.name);
                }
              }}
            >
              {/* Package name */}
              <span data-part="name">{result.name}</span>

              {/* Version */}
              <span data-part="version">{result.version}</span>

              {/* Description */}
              <span data-part="desc">{result.description}</span>

              {/* Download count */}
              {result.downloads != null && (
                <span data-part="downloads" aria-label={`${result.downloads} downloads`}>
                  {formatDownloads(result.downloads)}
                </span>
              )}

              {/* Author */}
              {result.author && (
                <span data-part="author">{result.author}</span>
              )}

              {/* Keywords */}
              {result.keywords && result.keywords.length > 0 && (
                <div data-part="keywords">
                  {result.keywords.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      data-part="keyword"
                      aria-label={`Filter by keyword: ${kw}`}
                      tabIndex={-1}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKeywordClick(kw);
                      }}
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div data-part="pagination" data-state={state} role="navigation" aria-label="Search result pages">
          <button
            type="button"
            data-part="pagination-prev"
            aria-label="Previous page"
            disabled={page === 0}
            onClick={() => {
              setPage((p) => Math.max(0, p - 1));
              setFocusIndex(-1);
            }}
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
            onClick={() => {
              setPage((p) => Math.min(totalPages - 1, p + 1));
              setFocusIndex(-1);
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && internalQuery.trim() !== '' && results.length === 0 && (
        <div data-part="empty" data-state={state} data-visible="true" role="status" aria-live="polite">
          No packages found for &ldquo;{internalQuery}&rdquo;. Try a different search term.
        </div>
      )}

      {/* Idle empty state — no query entered */}
      {!loading && internalQuery.trim() === '' && results.length === 0 && (
        <div data-part="empty" data-state={state} data-visible="true" role="status" aria-live="polite">
          Enter a search term to find packages.
        </div>
      )}

      {children}
    </div>
  );
});

RegistrySearch.displayName = 'RegistrySearch';
export { RegistrySearch };
export default RegistrySearch;
