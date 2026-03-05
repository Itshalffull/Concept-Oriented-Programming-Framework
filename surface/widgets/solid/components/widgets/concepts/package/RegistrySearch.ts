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

export interface RegistrySearchProps { [key: string]: unknown; class?: string; }
export interface RegistrySearchResult { element: HTMLElement; dispose: () => void; }

export function RegistrySearch(props: RegistrySearchProps): RegistrySearchResult {
  const sig = surfaceCreateSignal<RegistrySearchState>('idle');
  const state = () => sig.get();
  const send = (type: string) => sig.set(registrySearchReducer(sig.get(), { type } as any));
  const unsubs: (() => void)[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  const root = document.createElement('div');
  root.setAttribute('data-surface-widget', '');
  root.setAttribute('data-widget-name', 'registry-search');
  root.setAttribute('data-part', 'root');
  root.setAttribute('role', 'search');
  root.setAttribute('aria-label', 'Package registry search');
  root.setAttribute('data-state', state());
  root.setAttribute('tabindex', '0');
  if (props.class) root.className = props.class as string;

  /* Search input area */
  const searchWrapEl = document.createElement('div');
  searchWrapEl.setAttribute('data-part', 'search');
  searchWrapEl.setAttribute('data-state', state());
  const searchInput = document.createElement('input');
  searchInput.type = 'search';
  searchInput.setAttribute('data-part', 'search-input');
  searchInput.setAttribute('role', 'combobox');
  searchInput.setAttribute('aria-label', 'Search packages');
  searchInput.setAttribute('aria-expanded', 'false');
  searchInput.setAttribute('aria-controls', 'registry-search-results');
  searchInput.setAttribute('aria-autocomplete', 'list');
  searchInput.autocomplete = 'off';
  searchInput.placeholder = 'Search packages\u2026';
  searchInput.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const value = searchInput.value;
    if (value.trim()) {
      send('INPUT');
      debounceTimer = setTimeout(() => {
        send('RESULTS');
      }, 200);
    } else {
      send('CLEAR');
    }
  });
  searchWrapEl.appendChild(searchInput);
  root.appendChild(searchWrapEl);

  /* Suggestions dropdown */
  const suggestionsEl = document.createElement('div');
  suggestionsEl.setAttribute('data-part', 'suggestions');
  suggestionsEl.setAttribute('data-state', state());
  suggestionsEl.setAttribute('data-visible', 'false');
  suggestionsEl.setAttribute('role', 'listbox');
  suggestionsEl.setAttribute('aria-label', 'Suggestions');
  const suggestionLoading = document.createElement('div');
  suggestionLoading.setAttribute('data-part', 'suggestion-loading');
  suggestionLoading.setAttribute('role', 'status');
  suggestionLoading.setAttribute('aria-live', 'polite');
  suggestionLoading.textContent = 'Searching\u2026';
  suggestionLoading.style.display = 'none';
  suggestionsEl.appendChild(suggestionLoading);
  root.appendChild(suggestionsEl);

  /* Result list */
  const resultsEl = document.createElement('div');
  resultsEl.id = 'registry-search-results';
  resultsEl.setAttribute('data-part', 'results');
  resultsEl.setAttribute('data-state', state());
  resultsEl.setAttribute('role', 'listbox');
  resultsEl.setAttribute('aria-label', 'Search results');

  /* Template result item */
  const resultEl = document.createElement('div');
  resultEl.setAttribute('data-part', 'result');
  resultEl.setAttribute('data-state', state());
  resultEl.setAttribute('role', 'option');
  resultEl.setAttribute('aria-selected', 'false');
  resultEl.setAttribute('tabindex', '-1');
  resultEl.style.cursor = 'pointer';
  resultEl.addEventListener('click', () => { send('SELECT_RESULT'); });

  const nameSpan = document.createElement('span');
  nameSpan.setAttribute('data-part', 'name');
  nameSpan.textContent = 'package-name';
  resultEl.appendChild(nameSpan);

  const versionSpan = document.createElement('span');
  versionSpan.setAttribute('data-part', 'version');
  versionSpan.textContent = '1.0.0';
  resultEl.appendChild(versionSpan);

  const descSpan = document.createElement('span');
  descSpan.setAttribute('data-part', 'desc');
  descSpan.textContent = 'Package description';
  resultEl.appendChild(descSpan);

  const downloadsSpan = document.createElement('span');
  downloadsSpan.setAttribute('data-part', 'downloads');
  downloadsSpan.textContent = '0';
  resultEl.appendChild(downloadsSpan);

  const keywordsEl = document.createElement('div');
  keywordsEl.setAttribute('data-part', 'keywords');
  const kwBtn = document.createElement('button');
  kwBtn.type = 'button';
  kwBtn.setAttribute('data-part', 'keyword');
  kwBtn.setAttribute('tabindex', '-1');
  kwBtn.textContent = 'keyword';
  kwBtn.addEventListener('click', (e) => { e.stopPropagation(); });
  keywordsEl.appendChild(kwBtn);
  resultEl.appendChild(keywordsEl);

  resultsEl.appendChild(resultEl);
  root.appendChild(resultsEl);

  /* Pagination */
  const paginationEl = document.createElement('div');
  paginationEl.setAttribute('data-part', 'pagination');
  paginationEl.setAttribute('data-state', state());
  paginationEl.setAttribute('role', 'navigation');
  paginationEl.setAttribute('aria-label', 'Search result pages');
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.setAttribute('data-part', 'pagination-prev');
  prevBtn.setAttribute('aria-label', 'Previous page');
  prevBtn.textContent = 'Previous';
  paginationEl.appendChild(prevBtn);
  const pageInfo = document.createElement('span');
  pageInfo.setAttribute('data-part', 'pagination-info');
  pageInfo.setAttribute('aria-current', 'page');
  pageInfo.textContent = 'Page 1 of 1';
  paginationEl.appendChild(pageInfo);
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.setAttribute('data-part', 'pagination-next');
  nextBtn.setAttribute('aria-label', 'Next page');
  nextBtn.textContent = 'Next';
  paginationEl.appendChild(nextBtn);
  root.appendChild(paginationEl);

  /* Empty state */
  const emptyStateEl = document.createElement('div');
  emptyStateEl.setAttribute('data-part', 'empty');
  emptyStateEl.setAttribute('data-state', state());
  emptyStateEl.setAttribute('data-visible', 'true');
  emptyStateEl.setAttribute('role', 'status');
  emptyStateEl.setAttribute('aria-live', 'polite');
  emptyStateEl.textContent = 'Enter a search term to find packages.';
  root.appendChild(emptyStateEl);

  /* Keyboard navigation */
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      send('SELECT_RESULT');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchInput.value = '';
      send('CLEAR');
      searchInput.focus();
    }
  });

  /* Subscribe to state changes */
  unsubs.push(sig.subscribe((s) => {
    root.setAttribute('data-state', s);
    searchWrapEl.setAttribute('data-state', s);
    suggestionsEl.setAttribute('data-state', s);
    resultsEl.setAttribute('data-state', s);
    paginationEl.setAttribute('data-state', s);
    emptyStateEl.setAttribute('data-state', s);
    const isSearching = s === 'searching';
    suggestionsEl.setAttribute('data-visible', isSearching ? 'true' : 'false');
    suggestionLoading.style.display = isSearching ? 'block' : 'none';
    searchInput.setAttribute('aria-expanded', isSearching ? 'true' : 'false');
  }));

  return {
    element: root,
    dispose() {
      unsubs.forEach((u) => u());
      if (debounceTimer) clearTimeout(debounceTimer);
      root.remove();
    },
  };
}

export default RegistrySearch;
