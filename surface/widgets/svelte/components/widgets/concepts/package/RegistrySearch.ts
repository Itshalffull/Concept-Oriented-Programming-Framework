import { createSignal as surfaceCreateSignal } from '../../../shared/surface-bridge.js';

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

/* --- Types --- */

export interface RegistrySearchResultItem {
  name: string;
  version: string;
  description: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
}

export interface RegistrySearchProps {
  [key: string]: unknown;
  class?: string;
  query: string;
  results: RegistrySearchResultItem[];
  sortBy?: 'relevance' | 'downloads' | 'date';
  pageSize?: number;
  loading?: boolean;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onSelect?: (packageName: string) => void;
  onKeywordClick?: (keyword: string) => void;
}
export interface RegistrySearchResult { element: HTMLElement; dispose: () => void; }

/* --- Helpers --- */

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const DEBOUNCE_MS = 200;

/* --- Component --- */

export function RegistrySearch(props: RegistrySearchProps): RegistrySearchResult {
  const sig = surfaceCreateSignal<RegistrySearchState>('idle');
  const send = (type: string) => sig.set(registrySearchReducer(sig.get(), { type } as any));

  const results = (props.results ?? []) as RegistrySearchResultItem[];
  const pageSize = (props.pageSize as number) ?? 20;
  const placeholder = (props.placeholder as string) ?? 'Search packages\u2026';
  const loading = !!props.loading;
  const onSearch = props.onSearch as ((q: string) => void) | undefined;
  const onSelect = props.onSelect as ((name: string) => void) | undefined;
  const onKeywordClick = props.onKeywordClick as ((kw: string) => void) | undefined;

  let internalQuery = (props.query as string) ?? '';
  let focusIndex = -1;
  let currentPage = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'registry-search');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'search');
  root.setAttribute('aria-label', 'Package registry search');
  root.setAttribute('data-state', sig.get());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  // Search input
  const searchDiv = document.createElement('div');
  searchDiv.setAttribute('data-part', 'search');
  root.appendChild(searchDiv);

  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-label', 'Search packages');
  searchInput.setAttribute('aria-autocomplete', 'list');
  searchInput.setAttribute('aria-controls', 'registry-search-results');
  searchInput.autocomplete = 'off';
  searchInput.placeholder = placeholder;
  searchInput.value = internalQuery;
  searchInput.addEventListener('input', () => {
    internalQuery = searchInput.value;
    focusIndex = -1;
    currentPage = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (internalQuery.trim()) {
      send('INPUT');
      debounceTimer = setTimeout(() => { onSearch?.(internalQuery); }, DEBOUNCE_MS);
    } else {
      send('CLEAR');
      onSearch?.('');
    }
  });
  searchDiv.appendChild(searchInput);

  // Suggestions
  const suggestionsEl = document.createElement('div');
  suggestionsEl.setAttribute('data-part', 'suggestions');
  suggestionsEl.setAttribute('role', 'listbox');
  suggestionsEl.setAttribute('aria-label', 'Suggestions');
  suggestionsEl.setAttribute('data-visible', 'false');
  root.appendChild(suggestionsEl);

  // Loading indicator
  const loadingEl = document.createElement('div');
  loadingEl.setAttribute('data-part', 'loading');
  loadingEl.setAttribute('role', 'status');
  loadingEl.setAttribute('aria-live', 'polite');
  loadingEl.setAttribute('aria-label', 'Loading search results');
  loadingEl.textContent = 'Loading results\u2026';
  loadingEl.style.display = loading ? '' : 'none';
  root.appendChild(loadingEl);

  // Results list
  const resultsEl = document.createElement('div');
  resultsEl.id = 'registry-search-results';
  resultsEl.setAttribute('data-part', 'results');
  resultsEl.setAttribute('role', 'listbox');
  resultsEl.setAttribute('aria-label', 'Search results');
  root.appendChild(resultsEl);

  // Pagination
  const paginationEl = document.createElement('div');
  paginationEl.setAttribute('data-part', 'pagination');
  paginationEl.setAttribute('role', 'navigation');
  paginationEl.setAttribute('aria-label', 'Search result pages');
  root.appendChild(paginationEl);

  // Empty state
  const emptyEl = document.createElement('div');
  emptyEl.setAttribute('data-part', 'empty');
  emptyEl.setAttribute('role', 'status');
  emptyEl.setAttribute('aria-live', 'polite');
  emptyEl.setAttribute('data-visible', 'true');
  root.appendChild(emptyEl);

  function getPaginated(): RegistrySearchResultItem[] {
    const start = currentPage * pageSize;
    return results.slice(start, start + pageSize);
  }

  function rebuildResults() {
    resultsEl.innerHTML = '';
    const paginated = getPaginated();
    const totalPages = Math.max(1, Math.ceil(results.length / pageSize));

    for (let i = 0; i < paginated.length; i++) {
      const result = paginated[i];
      const isFocused = i === focusIndex;
      const resultDiv = document.createElement('div');
      resultDiv.id = `registry-search-result-${i}`;
      resultDiv.setAttribute('data-part', 'result');
      resultDiv.setAttribute('role', 'option');
      resultDiv.setAttribute('aria-selected', isFocused ? 'true' : 'false');
      resultDiv.setAttribute('aria-label', `${result.name}@${result.version}`);
      resultDiv.setAttribute('tabindex', isFocused ? '0' : '-1');

      const nameSpan = document.createElement('span');
      nameSpan.setAttribute('data-part', 'name');
      nameSpan.textContent = result.name;
      resultDiv.appendChild(nameSpan);

      const verSpan = document.createElement('span');
      verSpan.setAttribute('data-part', 'version');
      verSpan.textContent = result.version;
      resultDiv.appendChild(verSpan);

      const descSpan = document.createElement('span');
      descSpan.setAttribute('data-part', 'desc');
      descSpan.textContent = result.description;
      resultDiv.appendChild(descSpan);

      if (result.downloads != null) {
        const dlSpan = document.createElement('span');
        dlSpan.setAttribute('data-part', 'downloads');
        dlSpan.setAttribute('aria-label', `${result.downloads} downloads`);
        dlSpan.textContent = formatDownloads(result.downloads);
        resultDiv.appendChild(dlSpan);
      }

      if (result.author) {
        const authorSpan = document.createElement('span');
        authorSpan.setAttribute('data-part', 'author');
        authorSpan.textContent = result.author;
        resultDiv.appendChild(authorSpan);
      }

      if (result.keywords && result.keywords.length > 0) {
        const kwDiv = document.createElement('div');
        kwDiv.setAttribute('data-part', 'keywords');
        for (const kw of result.keywords) {
          const kwBtn = document.createElement('button');
          kwBtn.type = 'button';
          kwBtn.setAttribute('data-part', 'keyword');
          kwBtn.setAttribute('aria-label', `Filter by keyword: ${kw}`);
          kwBtn.setAttribute('tabindex', '-1');
          kwBtn.textContent = kw;
          kwBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            internalQuery = kw;
            searchInput.value = kw;
            currentPage = 0;
            send('INPUT');
            onKeywordClick?.(kw);
            onSearch?.(kw);
          });
          kwDiv.appendChild(kwBtn);
        }
        resultDiv.appendChild(kwDiv);
      }

      resultDiv.addEventListener('click', () => {
        send('SELECT_RESULT');
        onSelect?.(result.name);
      });

      resultsEl.appendChild(resultDiv);
    }

    // Pagination
    paginationEl.innerHTML = '';
    if (totalPages > 1) {
      paginationEl.style.display = '';
      const prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.setAttribute('data-part', 'pagination-prev');
      prevBtn.setAttribute('aria-label', 'Previous page');
      prevBtn.disabled = currentPage === 0;
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', () => { currentPage = Math.max(0, currentPage - 1); focusIndex = -1; rebuildResults(); });
      paginationEl.appendChild(prevBtn);

      const infoSpan = document.createElement('span');
      infoSpan.setAttribute('data-part', 'pagination-info');
      infoSpan.setAttribute('aria-current', 'page');
      infoSpan.textContent = `Page ${currentPage + 1} of ${totalPages}`;
      paginationEl.appendChild(infoSpan);

      const nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.setAttribute('data-part', 'pagination-next');
      nextBtn.setAttribute('aria-label', 'Next page');
      nextBtn.disabled = currentPage >= totalPages - 1;
      nextBtn.textContent = 'Next';
      nextBtn.addEventListener('click', () => { currentPage = Math.min(totalPages - 1, currentPage + 1); focusIndex = -1; rebuildResults(); });
      paginationEl.appendChild(nextBtn);
    } else {
      paginationEl.style.display = 'none';
    }

    // Empty state
    if (!loading && internalQuery.trim() !== '' && results.length === 0) {
      emptyEl.textContent = `No packages found for \u201C${internalQuery}\u201D. Try a different search term.`;
      emptyEl.style.display = '';
    } else if (!loading && internalQuery.trim() === '' && results.length === 0) {
      emptyEl.textContent = 'Enter a search term to find packages.';
      emptyEl.style.display = '';
    } else {
      emptyEl.style.display = 'none';
    }
  }

  rebuildResults();

  // Keyboard
  root.addEventListener('keydown', (e: KeyboardEvent) => {
    const paginated = getPaginated();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusIndex = focusIndex < paginated.length - 1 ? focusIndex + 1 : 0;
      const el = resultsEl.querySelector<HTMLElement>(`#registry-search-result-${focusIndex}`);
      el?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focusIndex <= 0) { focusIndex = -1; searchInput.focus(); }
      else { focusIndex--; const el = resultsEl.querySelector<HTMLElement>(`#registry-search-result-${focusIndex}`); el?.focus(); }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusIndex >= 0 && focusIndex < paginated.length) {
        send('SELECT_RESULT');
        onSelect?.(paginated[focusIndex].name);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      internalQuery = '';
      searchInput.value = '';
      focusIndex = -1;
      send('CLEAR');
      onSearch?.('');
      searchInput.focus();
      rebuildResults();
    }
  });

  const unsub = sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchDiv.setAttribute('data-state', s);
    searchInput.setAttribute('aria-expanded', String(s === 'searching' || results.length > 0));
    suggestionsEl.setAttribute('data-state', s);
    suggestionsEl.setAttribute('data-visible', s === 'searching' ? 'true' : 'false');
    resultsEl.setAttribute('data-state', s);
  });

  return {
    element: root,
    dispose() {
      unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
      root.remove();
    },
  };
}

export default RegistrySearch;
