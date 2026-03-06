import {
  StackLayout,
  Label,
  Button,
  ScrollView,
  TextField,
} from '@nativescript/core';

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

export interface RegistrySearchResult {
  name: string;
  version: string;
  description: string;
  downloads?: number;
  author?: string;
  keywords?: string[];
}

export interface RegistrySearchProps {
  query: string;
  results: RegistrySearchResult[];
  sortBy?: 'relevance' | 'downloads' | 'date';
  pageSize?: number;
  loading?: boolean;
  placeholder?: string;
  onSearch?: (query: string) => void;
  onSelect?: (packageName: string) => void;
  onKeywordClick?: (keyword: string) => void;
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

const DEBOUNCE_MS = 200;

export function createRegistrySearch(props: RegistrySearchProps): {
  view: StackLayout;
  dispose: () => void;
} {
  let state: RegistrySearchState = 'idle';
  let internalQuery = props.query;
  let page = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pageSize = props.pageSize ?? 20;
  const disposers: (() => void)[] = [];

  function send(event: RegistrySearchEvent) {
    state = registrySearchReducer(state, event);
    update();
  }

  const root = new StackLayout();
  root.className = 'registry-search';
  root.automationText = 'Package registry search';

  const searchInput = new TextField();
  searchInput.hint = props.placeholder ?? 'Search packages\u2026';
  searchInput.text = internalQuery;
  const inputCb = () => {
    internalQuery = searchInput.text;
    page = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (internalQuery.trim()) {
      send({ type: 'INPUT' });
      debounceTimer = setTimeout(() => {
        props.onSearch?.(internalQuery);
      }, DEBOUNCE_MS);
    } else {
      send({ type: 'CLEAR' });
      props.onSearch?.('');
    }
  };
  searchInput.on('textChange', inputCb);
  disposers.push(() => {
    searchInput.off('textChange', inputCb);
    if (debounceTimer) clearTimeout(debounceTimer);
  });
  root.addChild(searchInput);

  const loadingLbl = new Label();
  loadingLbl.text = 'Loading results\u2026';
  root.addChild(loadingLbl);

  const resultsScroll = new ScrollView();
  const resultsList = new StackLayout();
  resultsScroll.content = resultsList;
  root.addChild(resultsScroll);

  const pagRow = new StackLayout();
  pagRow.orientation = 'horizontal';

  const prevBtn = new Button();
  prevBtn.text = 'Previous';
  prevBtn.on('tap', () => {
    page = Math.max(0, page - 1);
    update();
  });
  pagRow.addChild(prevBtn);

  const pageLbl = new Label();
  pageLbl.marginLeft = 8;
  pageLbl.marginRight = 8;
  pagRow.addChild(pageLbl);

  const nextBtn = new Button();
  nextBtn.text = 'Next';
  nextBtn.on('tap', () => {
    const tp = Math.max(1, Math.ceil(props.results.length / pageSize));
    page = Math.min(tp - 1, page + 1);
    update();
  });
  pagRow.addChild(nextBtn);
  root.addChild(pagRow);

  const emptyLbl = new Label();
  emptyLbl.textWrap = true;
  root.addChild(emptyLbl);

  function update() {
    loadingLbl.visibility = props.loading ? 'visible' : 'collapsed';

    const totalPages = Math.max(1, Math.ceil(props.results.length / pageSize));
    const start = page * pageSize;
    const paginated = props.results.slice(start, start + pageSize);

    resultsList.removeChildren();
    for (const result of paginated) {
      const item = new StackLayout();
      item.padding = 8;
      item.marginBottom = 4;
      item.borderWidth = 1;
      item.borderColor = '#e5e7eb';
      item.borderRadius = 4;

      const nameRow = new StackLayout();
      nameRow.orientation = 'horizontal';

      const nameLbl = new Label();
      nameLbl.text = result.name;
      nameLbl.fontWeight = 'bold';
      nameRow.addChild(nameLbl);

      const verLbl = new Label();
      verLbl.text = result.version;
      verLbl.marginLeft = 8;
      verLbl.fontSize = 13;
      nameRow.addChild(verLbl);

      if (result.downloads != null) {
        const dlLbl = new Label();
        dlLbl.text = formatDownloads(result.downloads);
        dlLbl.marginLeft = 8;
        dlLbl.fontSize = 12;
        nameRow.addChild(dlLbl);
      }
      item.addChild(nameRow);

      const descLbl = new Label();
      descLbl.text = result.description;
      descLbl.textWrap = true;
      descLbl.fontSize = 13;
      descLbl.marginTop = 2;
      item.addChild(descLbl);

      if (result.author) {
        const authLbl = new Label();
        authLbl.text = result.author;
        authLbl.fontSize = 12;
        authLbl.marginTop = 2;
        item.addChild(authLbl);
      }

      if (result.keywords && result.keywords.length > 0) {
        const kwRow = new StackLayout();
        kwRow.orientation = 'horizontal';
        kwRow.marginTop = 4;
        for (const kw of result.keywords) {
          const kwBtn = new Button();
          kwBtn.text = kw;
          kwBtn.fontSize = 11;
          kwBtn.padding = '2 6';
          kwBtn.on('tap', () => {
            internalQuery = kw;
            searchInput.text = kw;
            page = 0;
            send({ type: 'INPUT' });
            props.onKeywordClick?.(kw);
            props.onSearch?.(kw);
          });
          kwRow.addChild(kwBtn);
        }
        item.addChild(kwRow);
      }

      item.on('tap', () => {
        send({ type: 'SELECT_RESULT' });
        props.onSelect?.(result.name);
      });

      resultsList.addChild(item);
    }

    if (totalPages > 1) {
      pagRow.visibility = 'visible';
      prevBtn.isEnabled = page > 0;
      nextBtn.isEnabled = page < totalPages - 1;
      pageLbl.text = `Page ${page + 1} of ${totalPages}`;
    } else {
      pagRow.visibility = 'collapsed';
    }

    if (!props.loading && props.results.length === 0) {
      emptyLbl.visibility = 'visible';
      emptyLbl.text = internalQuery.trim()
        ? `No packages found for "${internalQuery}". Try a different search term.`
        : 'Enter a search term to find packages.';
    } else {
      emptyLbl.visibility = 'collapsed';
    }
  }

  update();

  return {
    view: root,
    dispose() {
      disposers.forEach((d) => d());
    },
  };
}

export default createRegistrySearch;
