/* ---------------------------------------------------------------------------
 * RegistrySearch — Vanilla implementation
 *
 * Package registry search with input, result cards, pagination,
 * and keyword click filtering.
 * ------------------------------------------------------------------------- */

export type RegistrySearchState = 'idle' | 'searching';
export type RegistrySearchEvent = | { type: 'INPUT' } | { type: 'SELECT_RESULT' } | { type: 'RESULTS' } | { type: 'CLEAR' };

export function registrySearchReducer(state: RegistrySearchState, event: RegistrySearchEvent): RegistrySearchState {
  switch (state) {
    case 'idle': if (event.type === 'INPUT') return 'searching'; return state;
    case 'searching': if (event.type === 'RESULTS' || event.type === 'CLEAR') return 'idle'; return state;
    default: return state;
  }
}

export interface RegistryResult { name: string; version: string; description?: string; keywords?: string[]; downloads?: number; date?: string; }

export interface RegistrySearchProps {
  [key: string]: unknown; className?: string;
  results?: RegistryResult[]; query?: string;
  page?: number; totalPages?: number;
  onSearch?: (query: string) => void;
  onSelect?: (name: string) => void;
  onPageChange?: (page: number) => void;
}
export interface RegistrySearchOptions { target: HTMLElement; props: RegistrySearchProps; }

let _registrySearchUid = 0;

function formatDownloads(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}

export class RegistrySearch {
  private el: HTMLElement;
  private props: RegistrySearchProps;
  private state: RegistrySearchState = 'idle';
  private disposers: Array<() => void> = [];
  private queryValue = '';

  constructor(options: RegistrySearchOptions) {
    this.props = { ...options.props };
    this.queryValue = (this.props.query as string) ?? '';
    this.el = document.createElement('div');
    this.el.setAttribute('data-surface-widget', '');
    this.el.setAttribute('data-widget-name', 'registry-search');
    this.el.setAttribute('data-part', 'root');
    this.el.setAttribute('role', 'search');
    this.el.setAttribute('aria-label', 'Registry search');
    this.el.setAttribute('tabindex', '0');
    this.el.id = 'registry-search-' + (++_registrySearchUid);
    this.render();
    options.target.appendChild(this.el);
  }

  getElement(): HTMLElement { return this.el; }
  send(type: string): void { this.state = registrySearchReducer(this.state, { type } as any); this.el.setAttribute('data-state', this.state); }
  update(props: Partial<RegistrySearchProps>): void { Object.assign(this.props, props); if (props.query !== undefined) this.queryValue = props.query as string; this.cleanup(); this.el.innerHTML = ''; this.render(); }
  destroy(): void { this.cleanup(); this.el.remove(); }
  private cleanup(): void { for (const d of this.disposers) d(); this.disposers = []; }

  private render(): void {
    const results = (this.props.results ?? []) as RegistryResult[];
    const { page = 0, totalPages = 1 } = this.props;
    this.el.setAttribute('data-state', this.state);
    if (this.props.className) this.el.className = this.props.className;

    // Search input
    const searchInput = document.createElement('input');
    searchInput.setAttribute('data-part', 'search-input');
    searchInput.setAttribute('type', 'search');
    searchInput.setAttribute('placeholder', 'Search packages...');
    searchInput.setAttribute('aria-label', 'Search packages');
    searchInput.setAttribute('role', 'combobox');
    searchInput.value = this.queryValue;
    const onInput = () => { this.queryValue = searchInput.value; this.send(this.queryValue ? 'INPUT' : 'CLEAR'); this.props.onSearch?.(this.queryValue); };
    searchInput.addEventListener('input', onInput);
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); this.props.onSearch?.(this.queryValue); } };
    searchInput.addEventListener('keydown', onKeyDown);
    this.disposers.push(() => searchInput.removeEventListener('input', onInput), () => searchInput.removeEventListener('keydown', onKeyDown));
    this.el.appendChild(searchInput);

    // Result list
    const resultList = document.createElement('div');
    resultList.setAttribute('data-part', 'result-list');
    resultList.setAttribute('role', 'list');
    if (results.length === 0) {
      const empty = document.createElement('div');
      empty.setAttribute('data-part', 'empty-state');
      empty.textContent = this.queryValue ? 'No packages found' : 'Enter a search query';
      resultList.appendChild(empty);
    } else {
      for (const result of results) {
        const card = document.createElement('div');
        card.setAttribute('data-part', 'result-card');
        card.setAttribute('role', 'listitem');

        const name = document.createElement('span');
        name.setAttribute('data-part', 'card-name');
        name.textContent = result.name;
        card.appendChild(name);

        const version = document.createElement('span');
        version.setAttribute('data-part', 'card-version');
        version.textContent = `v${result.version}`;
        card.appendChild(version);

        if (result.description) { const desc = document.createElement('span'); desc.setAttribute('data-part', 'card-desc'); desc.textContent = result.description; card.appendChild(desc); }
        if (result.keywords?.length) {
          const kw = document.createElement('div');
          kw.setAttribute('data-part', 'card-keywords');
          for (const k of result.keywords) {
            const chip = document.createElement('span');
            chip.setAttribute('data-part', 'keyword');
            chip.textContent = k;
            const onKw = () => { this.queryValue = k; searchInput.value = k; this.props.onSearch?.(k); };
            chip.addEventListener('click', onKw);
            this.disposers.push(() => chip.removeEventListener('click', onKw));
            kw.appendChild(chip);
          }
          card.appendChild(kw);
        }
        if (result.downloads != null) { const dl = document.createElement('span'); dl.setAttribute('data-part', 'card-downloads'); dl.textContent = `${formatDownloads(result.downloads)} downloads`; card.appendChild(dl); }
        if (result.date) { const dt = document.createElement('span'); dt.setAttribute('data-part', 'card-date'); dt.textContent = result.date; card.appendChild(dt); }

        const onClick = () => { this.send('SELECT_RESULT'); this.props.onSelect?.(result.name); };
        card.addEventListener('click', onClick);
        this.disposers.push(() => card.removeEventListener('click', onClick));
        resultList.appendChild(card);
      }
    }
    this.el.appendChild(resultList);

    // Pagination
    if ((totalPages as number) > 1) {
      const pagination = document.createElement('div');
      pagination.setAttribute('data-part', 'pagination');
      pagination.setAttribute('role', 'navigation');
      const prevBtn = document.createElement('button');
      prevBtn.setAttribute('type', 'button');
      prevBtn.textContent = '\u2190';
      if ((page as number) <= 0) prevBtn.setAttribute('disabled', '');
      const onPrev = () => this.props.onPageChange?.((page as number) - 1);
      prevBtn.addEventListener('click', onPrev);
      this.disposers.push(() => prevBtn.removeEventListener('click', onPrev));
      pagination.appendChild(prevBtn);
      const info = document.createElement('span');
      info.textContent = `Page ${(page as number) + 1} of ${totalPages}`;
      pagination.appendChild(info);
      const nextBtn = document.createElement('button');
      nextBtn.setAttribute('type', 'button');
      nextBtn.textContent = '\u2192';
      if ((page as number) >= (totalPages as number) - 1) nextBtn.setAttribute('disabled', '');
      const onNext = () => this.props.onPageChange?.((page as number) + 1);
      nextBtn.addEventListener('click', onNext);
      this.disposers.push(() => nextBtn.removeEventListener('click', onNext));
      pagination.appendChild(nextBtn);
      this.el.appendChild(pagination);
    }
  }
}

export default RegistrySearch;
